import { describe, expect, it } from "vitest";
import { distanceMiles, nearestZips } from "../src/nearby";
import { noCityGeo } from "./geo";
import type { Geo } from "../src/service";
import { handle, type Deps } from "../src/index";
import type { StatusResponse } from "../src/contract";
import type { SourceAdapter, SystemSummary } from "../src/adapters/types";

describe("nearestZips", () => {
  it("haversine sanity: Baltimore to Washington DC is ~35 miles", () => {
    const d = distanceMiles(39.2904, -76.6122, 38.9072, -77.0369);
    expect(d).toBeGreaterThan(33);
    expect(d).toBeLessThan(38);
  });

  it("finds 21202 near 21231, sorted nearest first, excluding itself", () => {
    const out = nearestZips("21231", 5, 20);
    expect(out).toHaveLength(5);
    expect(out.map((n) => n.zip)).not.toContain("21231");
    expect(out.map((n) => n.zip)).toContain("21202");
    expect(out[0]!.distanceMiles).toBeLessThan(2);
    for (let i = 1; i < out.length; i++) expect(out[i]!.distanceMiles).toBeGreaterThanOrEqual(out[i - 1]!.distanceMiles);
  });

  it("respects the radius and returns [] for unknown ZIPs", () => {
    expect(nearestZips("21231", 50, 0.5)).toEqual([]);
    expect(nearestZips("99999", 5, 20)).toEqual([]);
  });
});

const community = (p: Partial<SystemSummary>): SystemSummary => ({
  pwsid: "BAL1", name: "City of Baltimore", populationServed: 1600000, kind: "community",
  totalViolations: 0, healthBasedViolations: 0, sourceUrl: null, ...p,
});

class ByZipAdapter implements SourceAdapter {
  sourceName = "fake";
  calls: string[] = [];
  constructor(private byZip: Record<string, SystemSummary[]>) {}
  async listSystems(zip: string) { this.calls.push(zip); return this.byZip[zip] ?? []; }
  async getDetail() { return { violations: [], openHealthBased: 0, openTotal: 0 }; }
  dataThrough = "2025-12-31";
  systemUrl(pwsid: string) { return `https://src/${pwsid}`; }
  dataAsOf() { return "Q2 2026"; }
}
/** Real nearest-ZIP search; `cityUtilities` says which ZIPs have a registered city utility (nearby ZIPs must). */
const geoWith = (cityUtilities: Record<string, SystemSummary[]>): Geo => ({ ...noCityGeo, cityCandidates: (place) => cityUtilities[place.zip] ?? [] });
const run = async (adapter: SourceAdapter, zip: string, geo: Geo = noCityGeo): Promise<StatusResponse> => {
  const d: Deps = { adapter, cache: { get: async () => null, put: async () => {} }, now: () => new Date("2026-09-30T12:00:00Z"), geo };
  return (await handle(new Request(`https://api.test/status?zip=${zip}`), d)).json() as Promise<StatusResponse>;
};

describe("nearby fallback", () => {
  it("uses the closest ZIP that has records and labels it", async () => {
    const a = new ByZipAdapter({ "21202": [community({})] });
    const body = await run(a, "21231", geoWith({ "21202": [community({})] }));
    expect(body.status).toBe("green");
    expect(body.nearby?.zip).toBe("21202");
    expect(body.nearby!.distanceMiles).toBeLessThan(2);
    expect(body.note).toContain("21231");
    expect(body.note).toContain("21202");
    expect(body.note).toMatch(/may not be the system that serves you/);
    expect(body.systems[0]!.name).toBe("City of Baltimore");
  });

  it("does not fall back when the requested ZIP has records", async () => {
    const a = new ByZipAdapter({ "21231": [community({})], "21202": [community({ pwsid: "OTHER" })] });
    const body = await run(a, "21231");
    expect(body.nearby).toBeNull();
    expect(body.note).toBeNull();
    expect(a.calls).toEqual(["21231"]);
  });

  it("ignores nearby ZIPs that only have non-community systems", async () => {
    const a = new ByZipAdapter({ "21202": [community({ kind: "other" })], "21224": [community({ pwsid: "GOOD" })] });
    const body = await run(a, "21231", geoWith({ "21224": [community({ pwsid: "GOOD" })] }));
    expect(body.nearby?.zip).toBe("21224");
  });

  it("stays unknown when nothing is found, trying at most the attempt cap", async () => {
    const a = new ByZipAdapter({});
    const body = await run(a, "21231");
    expect(body.status).toBe("unknown");
    expect(body.nearby).toBeNull();
    expect(a.calls.length).toBe(1 + 10);
  });

  it("does not attempt a fallback for a ZIP with no centroid", async () => {
    const a = new ByZipAdapter({});
    await run(a, "99999");
    expect(a.calls).toEqual(["99999"]);
  });
});
