import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { WaterViolationsAdapter } from "../src/adapters/waterviolations";
import { SourceError } from "../src/adapters/types";
import { INDEX_DATA_END } from "../src/data/systemIndex";

const fixture = (name: string) => readFileSync(`test/fixtures/${name}`, "utf8") // vitest runs from the backend root;
const ok = (body: string) => new Response(body, { status: 200, headers: { "content-type": "application/json" } });

function adapterWith(handler: (url: string) => Response | Promise<Response>) {
  const calls: string[] = [];
  const fetchFn = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return handler(String(input));
  }) as typeof fetch;
  return { adapter: new WaterViolationsAdapter({ fetch: fetchFn, minIntervalMs: 0 }), calls };
}

describe("listSystems (real captured responses)", () => {
  it("maps Flint's ZIP response", async () => {
    const { adapter, calls } = adapterWith(() => ok(fixture("zip-48503.json")));
    const systems = await adapter.listSystems("48503");
    expect(calls).toEqual(["https://waterviolations.org/api/v1/zip/48503"]);
    expect(systems).toHaveLength(10);
    const flint = systems.find((s) => s.pwsid === "MI0002310")!;
    expect(flint).toEqual({
      pwsid: "MI0002310",
      name: "City of Flint",
      populationServed: 81252,
      kind: "community",
      totalViolations: 8,
      healthBasedViolations: 1,
      sourceUrl: "https://waterviolations.org/system/city-of-flint-mi0002310",
    });
    expect(systems.find((s) => s.pwsid === "MI2101225")!.kind).toBe("other"); // Transient Non-Community
  });

  it("returns [] for a ZIP with systems:null", async () => {
    const { adapter } = adapterWith(() => ok(fixture("zip-99999.json")));
    expect(await adapter.listSystems("99999")).toEqual([]);
  });

  it("treats upstream 400 (malformed ZIP) as not covered", async () => {
    const { adapter } = adapterWith(() => new Response('{"error":"invalid zip code"}', { status: 400 }));
    expect(await adapter.listSystems("00000")).toEqual([]);
  });

  it("maps a ZIP that has only non-community systems", async () => {
    const { adapter } = adapterWith(() => ok(fixture("zip-10001.json")));
    const systems = await adapter.listSystems("10001");
    expect(systems.length).toBeGreaterThan(0);
    expect(systems.every((s) => s.kind === "other")).toBe(true);
  });
});

describe("getDetail (real captured responses)", () => {
  it("requests the lowercase PWSID and maps dates + open counts", async () => {
    const { adapter, calls } = adapterWith(() => ok(fixture("system-mi0002310.json")));
    const d = await adapter.getDetail("MI0002310");
    expect(calls).toEqual(["https://waterviolations.org/api/v1/system/mi0002310"]);
    expect(d.violations).toHaveLength(8);
    expect(d.violations[0]).toEqual({ healthBased: true, beginDate: "2024-10-17" });
    expect(d.openHealthBased).toBe(0);
    expect(d.openTotal).toBe(0);
  });

  it("maps recent_violations:null to an empty list", async () => {
    const { adapter } = adapterWith(() => ok(fixture("system-md0180016.json")));
    expect((await adapter.getDetail("MD0180016")).violations).toEqual([]);
  });

  it("maps a system with many health-based violations", async () => {
    const { adapter } = adapterWith(() => ok(fixture("system-co0254185.json")));
    const d = await adapter.getDetail("CO0254185");
    expect(d.violations).toHaveLength(29);
    expect(d.violations.filter((v) => v.healthBased).length).toBeGreaterThan(0);
  });

  it("uses source-reported open counts", async () => {
    const body = JSON.stringify({ violations_active: 2, violations_active_health: 1, recent_violations: [] });
    const { adapter } = adapterWith(() => ok(body));
    const d = await adapter.getDetail("xx1");
    expect(d.openHealthBased).toBe(1);
    expect(d.openTotal).toBe(2);
  });

  it("yields null beginDate for garbage dates", async () => {
    const body = JSON.stringify({ recent_violations: [{ health_based: true, begin_date: "nonsense" }] });
    const { adapter } = adapterWith(() => ok(body));
    expect((await adapter.getDetail("xx1")).violations[0]!.beginDate).toBeNull();
  });
});

describe("failure handling", () => {
  it("wraps 5xx in SourceError", async () => {
    const { adapter } = adapterWith(() => new Response("boom", { status: 503 }));
    await expect(adapter.listSystems("21202")).rejects.toBeInstanceOf(SourceError);
  });
  it("wraps network errors in SourceError", async () => {
    const { adapter } = adapterWith(() => { throw new TypeError("network down"); });
    await expect(adapter.listSystems("21202")).rejects.toBeInstanceOf(SourceError);
  });
  it("wraps non-JSON bodies in SourceError", async () => {
    const { adapter } = adapterWith(() => new Response("<html>", { status: 200 }));
    await expect(adapter.listSystems("21202")).rejects.toBeInstanceOf(SourceError);
  });
  it("errors when a system is not found", async () => {
    const { adapter } = adapterWith(() => new Response("nope", { status: 404 }));
    await expect(adapter.getDetail("zz9")).rejects.toBeInstanceOf(SourceError);
  });
});

describe("data freshness", () => {
  const { adapter } = adapterWith(() => ok("{}"));
  it("reports the period the source data covers, not today's date", () => {
    expect(adapter.dataThrough).toBe("2025-12-31");
    expect(adapter.dataAsOf(new Date("2026-10-29T00:00:00Z"))).toBe("December 2025");
    expect(adapter.dataAsOf(new Date("2027-03-01T00:00:00Z"))).toBe("December 2025");
  });
  it("links to a system page by lowercase pwsid", () => {
    expect(adapter.systemUrl("MD0300002")).toBe("https://waterviolations.org/system/md0300002");
  });
  it("the bundled system index was built against the same data end date", () => {
    expect(INDEX_DATA_END).toBe(adapter.dataThrough);
  });
});

describe("rate limiting", () => {
  it("spaces upstream calls by minIntervalMs", async () => {
    const times: number[] = [];
    const fetchFn = (async () => { times.push(Date.now()); return ok('{"systems":null}'); }) as typeof fetch;
    const adapter = new WaterViolationsAdapter({ fetch: fetchFn, minIntervalMs: 80 });
    await adapter.listSystems("21202");
    await adapter.listSystems("21203");
    expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(70);
  });
});
