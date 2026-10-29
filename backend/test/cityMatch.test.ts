import { describe, expect, it } from "vitest";
import { cityCandidates, normalizeCity } from "../src/cityMatch";
import { placeForZip } from "../src/places";
import { selectCityMatches } from "../src/scoring";
import { buildStatus, defaultGeo, type Geo } from "../src/service";
import type { SourceAdapter, SystemDetail, SystemSummary } from "../src/adapters/types";

const NOW = new Date("2026-10-29T12:00:00Z");
const sys = (p: Partial<SystemSummary>): SystemSummary => ({
  pwsid: "X1", name: "X", populationServed: 1000, kind: "community", totalViolations: 0, healthBasedViolations: 0, sourceUrl: null, ...p,
});

describe("placeForZip", () => {
  it("finds city/state/coords by binary search, including first and last rows", () => {
    expect(placeForZip("60601")).toMatchObject({ city: "Chicago", state: "IL" });
    expect(placeForZip("21231")).toMatchObject({ city: "Baltimore", state: "MD" });
    expect(placeForZip("00501")?.state).toBe("NY"); // lowest ZIP in the table
    expect(placeForZip("99950")?.state).toBe("AK"); // highest
  });
  it("returns null for ZIPs that don't exist", () => {
    expect(placeForZip("99999")).toBeNull();
    expect(placeForZip("00000")).toBeNull();
  });
});

describe("normalizeCity", () => {
  it("treats abbreviations and punctuation alike", () => {
    expect(normalizeCity("St. Louis")).toBe(normalizeCity("Saint Louis"));
    expect(normalizeCity("Ft. Worth")).toBe("fort worth");
    expect(normalizeCity("  WINSTON-SALEM ")).toBe("winstonsalem");
  });
});

describe("cityCandidates (real bundled index)", () => {
  const top = (zip: string) => cityCandidates(placeForZip(zip)!)[0]?.name;
  it("finds the city utility for big cities", () => {
    expect(top("21231")).toBe("City of Baltimore");
    expect(top("60601")).toBe("Chicago");
    expect(top("80202")).toBe("Denver Water Board");
    expect(top("98101")).toBe("Seattle Public Utilities");
    expect(top("77002")).toBe("City of Houston");
  });
  it("maps New York City ZIPs to the NYC system even though it is registered in Valhalla", () => {
    expect(cityCandidates(placeForZip("10001")!)[0]?.pwsid).toBe("NY7003493");
    expect(cityCandidates(placeForZip("11201")!)[0]?.pwsid).toBe("NY7003493"); // Brooklyn
  });
  it("only matches systems in the same state", () => {
    const names = cityCandidates(placeForZip("21204")!); // Towson
    expect(names.every((s) => s.pwsid.startsWith("MD"))).toBe(true);
  });
  it("returns nothing where no larger system is registered", () => {
    expect(cityCandidates(placeForZip("21204")!)).toEqual([]);
  });
});

describe("selectCityMatches", () => {
  it("keeps the largest plus comparably large systems, ignoring tiny ones", () => {
    const out = selectCityMatches([
      sys({ pwsid: "A", populationServed: 1_000_000 }),
      sys({ pwsid: "B", populationServed: 400_000 }),
      sys({ pwsid: "C", populationServed: 50_000 }),
    ]);
    expect(out.map((s) => s.pwsid)).toEqual(["A", "B"]);
  });
  it("caps the count and handles empty", () => {
    const many = Array.from({ length: 6 }, (_, i) => sys({ pwsid: `P${i}`, populationServed: 1000 - i }));
    expect(selectCityMatches(many)).toHaveLength(3);
    expect(selectCityMatches([])).toEqual([]);
  });
});

class FakeAdapter implements SourceAdapter {
  sourceName = "fake";
  constructor(private byZip: Record<string, SystemSummary[]>, private details: Record<string, SystemDetail> = {}) {}
  async listSystems(zip: string) { return this.byZip[zip] ?? []; }
  async getDetail(pwsid: string) {
    return this.details[pwsid] ?? { violations: [], openHealthBased: 0, openTotal: 0, sourceUrl: `https://src/${pwsid}` };
  }
  dataThrough = "2025-12-31";
  systemUrl(pwsid: string) { return `https://src/${pwsid}`; }
  dataAsOf() { return "December 2025"; }
}
const open: SystemDetail = { violations: [], openHealthBased: 1, openTotal: 1 };
const geoFor = (city: SystemSummary[]): Geo => ({
  placeFor: (zip) => ({ zip, lat: 0, lon: 0, state: "IL", city: "Chicago" }),
  cityCandidates: () => city,
  nearest: () => [],
});

describe("service: choosing systems", () => {
  it("Chicago case: scores the city's utility, not the red suburb sharing the ZIP", async () => {
    const chicago = sys({ pwsid: "IL9000001", name: "Chicago", populationServed: 2_700_000, totalViolations: 9 });
    const cicero = sys({ pwsid: "IL9000002", name: "Cicero", populationServed: 83_000, totalViolations: 3, healthBasedViolations: 1 });
    const adapter = new FakeAdapter({ "60601": [chicago, cicero] }, { IL9000002: open });
    const body = await buildStatus("60601", adapter, NOW, geoFor([chicago]));
    expect(body.systems.map((s) => s.name)).toEqual(["Chicago"]);
    expect(body.status).toBe("green"); // Chicago has no open or recent health-based violation in the fake detail
    expect(body.note).toBeNull(); // direct match: no caveat
    expect(body.multipleSystems).toBe(false);
  });

  it("uses the city utility, with a note, when the ZIP lists none of it", async () => {
    const denver = sys({ pwsid: "CO9000001", name: "Denver Water Board", populationServed: 1_287_000, totalViolations: 5 });
    const unrelated = sys({ pwsid: "FL1", name: "Palms of Archer", populationServed: 1092, totalViolations: 3, healthBasedViolations: 1 });
    const adapter = new FakeAdapter({ "60601": [unrelated] }, { FL1: open });
    const body = await buildStatus("60601", adapter, NOW, geoFor([denver]));
    expect(body.systems.map((s) => s.name)).toEqual(["Denver Water Board"]);
    expect(body.status).toBe("green");
    expect(body.note).toMatch(/registered in Chicago, IL/);
    expect(body.note).toMatch(/may not be the one that serves your address/);
    expect(body.systems[0]!.sourceUrl).toBe("https://src/CO9000001"); // from the adapter
    expect(body.nearby).toBeNull();
  });

  it("falls back to the ZIP's own community systems when the city has no larger system", async () => {
    const local = sys({ pwsid: "IL9", name: "Local WSD", totalViolations: 0 });
    const body = await buildStatus("60601", new FakeAdapter({ "60601": [local] }), NOW, geoFor([]));
    expect(body.systems.map((s) => s.name)).toEqual(["Local WSD"]);
    expect(body.note).toBeNull();
  });

  it("an open violation at the city's own utility still turns the result red", async () => {
    const chicago = sys({ pwsid: "IL9000001", name: "Chicago", populationServed: 2_700_000, totalViolations: 9 });
    const body = await buildStatus("60601", new FakeAdapter({ "60601": [chicago] }, { IL9000001: open }), NOW, geoFor([chicago]));
    expect(body.status).toBe("red");
  });

  it("works end to end on the real index for 80202 even when the source lists unrelated systems", async () => {
    const unrelated = sys({ pwsid: "FL2010042", name: "Palms of Archer", populationServed: 1092, totalViolations: 14, healthBasedViolations: 1 });
    const body = await buildStatus("80202", new FakeAdapter({ "80202": [unrelated] }), NOW, defaultGeo);
    expect(body.systems.map((s) => s.name)).toEqual(["Denver Water Board"]);
  });

  it("nearby fallback never accepts an arbitrary small system from another ZIP", async () => {
    const small = sys({ pwsid: "CA9", name: "Sonoma Mutual", populationServed: 200, totalViolations: 0 });
    const geo: Geo = {
      placeFor: (zip) => ({ zip, lat: 0, lon: 0, state: "CA", city: "San Francisco" }),
      cityCandidates: () => [],
      nearest: () => [{ zip: "94117", distanceMiles: 1 }],
    };
    const body = await buildStatus("94103", new FakeAdapter({ "94117": [small] }), NOW, geo);
    expect(body.status).toBe("unknown");
    expect(body.nearby).toBeNull();
  });

  it("scores an indexed system from bundled data with no live detail call, and cites its source page", async () => {
    // Real Baltimore id: present in the bundled index, so no network detail should be needed.
    const baltimore = sys({ pwsid: "MD0300002", name: "City of Baltimore", populationServed: 1_600_000, totalViolations: 32 });
    const adapter = new FakeAdapter({ "21202": [baltimore] });
    let detailCalls = 0;
    adapter.getDetail = async () => { detailCalls++; throw new Error("should not be called"); };
    const noCity: Geo = { placeFor: () => null, cityCandidates: () => [], nearest: () => [] };
    const body = await buildStatus("21202", adapter, NOW, noCity);
    expect(detailCalls).toBe(0);
    expect(body.systems[0]!.sourceUrl).toBe("https://src/MD0300002");
    expect(["green", "yellow", "red"]).toContain(body.status);
  });
});
