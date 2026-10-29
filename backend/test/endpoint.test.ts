import { describe, expect, it } from "vitest";
import { handle, type Deps } from "../src/index";
import type { StatusResponse } from "../src/contract";
import { noCityGeo } from "./geo";
import { SourceError, type SourceAdapter, type SystemDetail, type SystemSummary } from "../src/adapters/types";

class FakeAdapter implements SourceAdapter {
  sourceName = "fake";
  zipCalls = 0;
  fail = false;
  constructor(private systems: SystemSummary[], private details: Record<string, SystemDetail> = {}) {}
  async listSystems() { this.zipCalls++; if (this.fail) throw new SourceError("down"); return this.systems; }
  async getDetail(pwsid: string) { return this.details[pwsid] ?? { violations: [], openHealthBased: 0, openTotal: 0 }; }
  dataThrough = "2025-12-31";
  systemUrl(pwsid: string) { return `https://src/${pwsid}`; }
  dataAsOf() { return "Q2 2026"; }
}

function deps(adapter: SourceAdapter) {
  const store = new Map<string, StatusResponse>();
  const d: Deps = {
    adapter,
    cache: { get: async (z) => store.get(z) ?? null, put: async (z, v) => void store.set(z, v) },
    now: () => new Date("2026-09-30T12:00:00Z"),
    geo: noCityGeo,
  };
  return { d, store };
}
const req = (path: string, method = "GET") => new Request(`https://api.test${path}`, { method });
const community = (p: Partial<SystemSummary>): SystemSummary => ({
  pwsid: "AA1", name: "Sys", populationServed: 1000, kind: "community", totalViolations: 0, healthBasedViolations: 0, sourceUrl: null, ...p,
});

describe("GET /status validation", () => {
  it.each(["", "1234", "123456", "abcde", "12 45", "12345-6789", "00000", "1234a"])("rejects zip=%j", async (zip) => {
    const { d } = deps(new FakeAdapter([]));
    const res = await handle(req(`/status?zip=${encodeURIComponent(zip)}`), d);
    expect(res.status).toBe(400);
    expect((await res.json() as any).error.code).toBe("invalid_zip");
  });

  it("rejects a missing zip param", async () => {
    const res = await handle(req("/status"), deps(new FakeAdapter([])).d);
    expect(res.status).toBe(400);
  });

  it("404 on unknown path, 405 on non-GET", async () => {
    const { d } = deps(new FakeAdapter([]));
    expect((await handle(req("/nope"), d)).status).toBe(404);
    expect((await handle(req("/status?zip=21202", "POST"), d)).status).toBe(405);
  });

  it("never calls the source for invalid input", async () => {
    const a = new FakeAdapter([]);
    await handle(req("/status?zip=bad"), deps(a).d);
    expect(a.zipCalls).toBe(0);
  });
});

describe("GET /status results", () => {
  it("returns the normalized contract for a green ZIP", async () => {
    const { d } = deps(new FakeAdapter([community({})]));
    const res = await handle(req("/status?zip=21202"), d);
    expect(res.status).toBe(200);
    const body = await res.json() as StatusResponse;
    expect(body).toMatchObject({
      status: "green",
      dataAsOf: "Q2 2026",
      multipleSystems: false,
      source: "fake",
      systems: [{ pwsid: "AA1", name: "Sys", populationServed: 1000, status: "green", sourceUrl: null }],
    });
    expect(body.summary).toContain("No health-based violations on record");
    expect(body.summary).toContain("EPA data as of Q2 2026");
    expect(body.disclaimer).toMatch(/not a guarantee/i);
  });

  it("uses the worst status across multiple systems", async () => {
    const a = new FakeAdapter(
      [community({ pwsid: "G" }), community({ pwsid: "R", totalViolations: 3, healthBasedViolations: 1 })],
      { R: { violations: [], openHealthBased: 1, openTotal: 1 } },
    );
    const body = await (await handle(req("/status?zip=21202"), deps(a).d)).json() as StatusResponse;
    expect(body.status).toBe("red");
    expect(body.multipleSystems).toBe(true);
    expect(body.systems.map((s) => s.status).sort()).toEqual(["green", "red"]);
  });

  it("returns unknown when nothing is covered", async () => {
    const body = await (await handle(req("/status?zip=99999"), deps(new FakeAdapter([])).d)).json() as StatusResponse;
    expect(body.status).toBe("unknown");
    expect(body.systems).toEqual([]);
    expect(body.multipleSystems).toBe(false);
  });

  it("never implies a fresh test in any summary", async () => {
    for (const d of [
      { violations: [], openHealthBased: 1, openTotal: 1 },
      { violations: [{ healthBased: true, beginDate: "2025-01-01" }], openHealthBased: 0, openTotal: 0 },
      { violations: [{ healthBased: false, beginDate: "2025-01-01" }], openHealthBased: 0, openTotal: 0 },
    ]) {
      const a = new FakeAdapter([community({ totalViolations: 1, healthBasedViolations: 1 })], { AA1: d });
      const body = await (await handle(req("/status?zip=21202"), deps(a).d)).json() as StatusResponse;
      expect(body.summary).not.toMatch(/tested|test result|safe to drink|is safe/i);
      expect(body.summary).toContain("EPA data as of");
    }
  });
});

describe("caching and errors", () => {
  it("serves the second request from cache without hitting the source", async () => {
    const a = new FakeAdapter([community({})]);
    const { d } = deps(a);
    const first = await handle(req("/status?zip=21202"), d);
    const second = await handle(req("/status?zip=21202"), d);
    expect(first.headers.get("x-cache")).toBe("MISS");
    expect(second.headers.get("x-cache")).toBe("HIT");
    expect(a.zipCalls).toBe(1);
    expect(await second.json()).toEqual(await first.json());
  });

  it("returns 502 on upstream failure and does not cache it", async () => {
    const a = new FakeAdapter([community({})]);
    a.fail = true;
    const { d, store } = deps(a);
    const res = await handle(req("/status?zip=21202"), d);
    expect(res.status).toBe(502);
    expect((await res.json() as any).error.code).toBe("upstream_unavailable");
    expect(store.size).toBe(0);
    a.fail = false;
    expect((await handle(req("/status?zip=21202"), d)).status).toBe(200);
  });
});
