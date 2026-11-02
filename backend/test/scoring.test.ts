import { describe, expect, it } from "vitest";
import type { HealthViolationFact, SystemFacts, SystemSummary } from "../src/adapters/types";
import { scoreSystem, selectCityMatches, selectSystems, worst } from "../src/scoring";
import { factsFromDetail } from "../src/facts";
import { shiftMonths } from "../src/dates";

// The data ends 2025-12-31. "Today" is deliberately never passed to scoring.
const ANCHOR = "2025-12-31";
const facts = (p: Partial<SystemFacts> = {}): SystemFacts => ({ health: [], openPaperwork: 0, paperwork12m: 0, ...p });
const hv = (p: Partial<HealthViolationFact>): HealthViolationFact => ({ date: "2024-01-01", cls: "g", open: false, ...p });
const sys = (p: Partial<SystemSummary>): SystemSummary => ({
  pwsid: "X1", name: "X", populationServed: 100, kind: "community", totalViolations: 0, healthBasedViolations: 0, sourceUrl: null, ...p,
});

describe("scoreSystem: red", () => {
  it("open urgent violations are red, naming the kind", () => {
    for (const cls of ["b", "n", "t"] as const) {
      const r = scoreSystem(facts({ health: [hv({ open: true, cls, date: "2025-03-01" })] }), ANCHOR);
      expect(r).toMatchObject({ status: "red", reason: "open_urgent", detail: { cls, date: "2025-03-01" } });
    }
  });
  it("an open violation of unknown type is treated as urgent", () => {
    const r = scoreSystem(facts({ health: [hv({ open: true, cls: null, date: null })] }), ANCHOR);
    expect(r).toMatchObject({ status: "red", reason: "open_urgent", detail: { cls: null } });
  });
  it("urgent beats a long-term open violation on the same system", () => {
    const r = scoreSystem(facts({ health: [hv({ open: true, cls: "g" }), hv({ open: true, cls: "b", date: "2025-03-01" })] }), ANCHOR);
    expect(r.status).toBe("red");
  });
});

describe("scoreSystem: old open urgent violations", () => {
  it("an open urgent violation older than 12 months is yellow, not red (the record may be stale)", () => {
    const r = scoreSystem(facts({ health: [hv({ open: true, cls: "t", date: "2017-12-18" })] }), ANCHOR);
    expect(r).toMatchObject({ status: "yellow", reason: "open_old_urgent", detail: { cls: "t", date: "2017-12-18" } });
  });
  it("12-month boundary for open urgent violations is inclusive", () => {
    expect(scoreSystem(facts({ health: [hv({ open: true, cls: "b", date: "2024-12-31" })] }), ANCHOR).status).toBe("red");
    expect(scoreSystem(facts({ health: [hv({ open: true, cls: "b", date: "2024-12-30" })] }), ANCHOR).status).toBe("yellow");
  });
  it("a fresh open urgent violation still wins over an old one", () => {
    const r = scoreSystem(facts({ health: [hv({ open: true, cls: "t", date: "2017-12-18" }), hv({ open: true, cls: "b", date: "2025-09-01" })] }), ANCHOR);
    expect(r).toMatchObject({ status: "red", reason: "open_urgent", detail: { cls: "b", date: "2025-09-01" } });
  });
  it("an old open violation of unknown type is yellow; one with no date is red", () => {
    expect(scoreSystem(facts({ health: [hv({ open: true, cls: null, date: "2018-01-01" })] }), ANCHOR).status).toBe("yellow");
    expect(scoreSystem(facts({ health: [hv({ open: true, cls: null, date: null })] }), ANCHOR).status).toBe("red");
  });
});

describe("scoreSystem: yellow", () => {
  it("an open long-term violation is yellow, however old", () => {
    const r = scoreSystem(facts({ health: [hv({ open: true, cls: "g", date: "2017-02-01" })] }), ANCHOR);
    expect(r).toMatchObject({ status: "yellow", reason: "open_longterm", detail: { date: "2017-02-01" } });
  });
  it("a resolved health-based violation in the last 12 months is yellow", () => {
    const r = scoreSystem(facts({ health: [hv({ date: "2025-06-15", cls: "b" })] }), ANCHOR);
    expect(r).toMatchObject({ status: "yellow", reason: "recent_health", detail: { date: "2025-06-15" } });
  });
  it("12-month boundary is inclusive", () => {
    expect(scoreSystem(facts({ health: [hv({ date: "2024-12-31" })] }), ANCHOR).status).toBe("yellow");
    expect(scoreSystem(facts({ health: [hv({ date: "2024-12-30" })] }), ANCHOR).status).toBe("green");
  });
  it("a violation with an unknown date counts as recent", () => {
    expect(scoreSystem(facts({ health: [hv({ date: null })] }), ANCHOR).status).toBe("yellow");
  });
  it("any open monitoring/reporting violation is yellow", () => {
    expect(scoreSystem(facts({ openPaperwork: 1 }), ANCHOR)).toMatchObject({ status: "yellow", reason: "paperwork_pattern" });
  });
  it("3+ monitoring/reporting violations in 12 months is yellow; 2 is not", () => {
    expect(scoreSystem(facts({ paperwork12m: 3 }), ANCHOR).status).toBe("yellow");
    expect(scoreSystem(facts({ paperwork12m: 2 }), ANCHOR).status).toBe("green");
  });
});

describe("scoreSystem: green", () => {
  it("is green with no facts or an empty record", () => {
    expect(scoreSystem(null, ANCHOR).status).toBe("green");
    expect(scoreSystem(facts(), ANCHOR)).toMatchObject({ status: "green", reason: "clean" });
  });
  it("older resolved health-based history stays green but is reported as history", () => {
    const r = scoreSystem(facts({ health: [hv({ date: "2022-09-01", cls: "b" }), hv({ date: "2021-03-01" })] }), ANCHOR);
    expect(r).toMatchObject({ status: "green", reason: "clean", detail: { historyDate: "2022-09-01" } });
  });
  it("a couple of closed paperwork items are mentioned, not scored", () => {
    expect(scoreSystem(facts({ paperwork12m: 2 }), ANCHOR).detail.minorPaperwork).toBe(2);
  });
  it("windows count from the data's end date, not from today (regression)", () => {
    // Violation 6 months before the data ends. Measured from "today" (Oct 2026) it would
    // look 15 months old and wrongly give green.
    const r = scoreSystem(facts({ health: [hv({ date: "2025-07-01" })] }), ANCHOR);
    expect(r.status).toBe("yellow");
    // and the same record read against a later anchor ages out
    expect(scoreSystem(facts({ health: [hv({ date: "2025-07-01" })] }), "2026-10-29").status).toBe("green");
  });
});

describe("worst", () => {
  it("returns null for nothing to combine", () => expect(worst([])).toBeNull());
  it("picks red over yellow over green", () => {
    const g = scoreSystem(facts(), ANCHOR);
    const y = scoreSystem(facts({ openPaperwork: 1 }), ANCHOR);
    const r = scoreSystem(facts({ health: [hv({ open: true, cls: "b", date: "2025-03-01" })] }), ANCHOR);
    expect(worst([g, y])?.status).toBe("yellow");
    expect(worst([y, r, g])?.status).toBe("red");
    expect(worst([g, g])?.status).toBe("green");
  });
});

describe("factsFromDetail (live API path: no violation types)", () => {
  const detail = (p: object) => ({ violations: [], openHealthBased: 0, openTotal: 0, ...p });
  it("keeps health-based violations inside the 5-year history and drops older ones", () => {
    const f = factsFromDetail(
      detail({ violations: [
        { healthBased: true, beginDate: "2025-02-01" },
        { healthBased: true, beginDate: "2019-01-01" }, // older than 5 years before the anchor
      ] }),
      ANCHOR,
    );
    expect(f.health.map((h) => h.date)).toEqual(["2025-02-01"]);
    expect(f.health.every((h) => h.cls === null)).toBe(true);
  });
  it("represents open health-based violations as open, unknown-type entries", () => {
    const f = factsFromDetail(detail({ openHealthBased: 2, openTotal: 3 }), ANCHOR);
    expect(f.health.filter((h) => h.open)).toHaveLength(2);
    expect(f.openPaperwork).toBe(1);
    expect(scoreSystem(f, ANCHOR).status).toBe("red");
  });
  it("counts paperwork inside the 12-month window only", () => {
    const f = factsFromDetail(
      detail({ violations: [
        { healthBased: false, beginDate: "2025-11-01" },
        { healthBased: false, beginDate: "2025-01-15" },
        { healthBased: false, beginDate: "2023-01-15" },
      ] }),
      ANCHOR,
    );
    expect(f.paperwork12m).toBe(2);
  });
});

describe("shiftMonths", () => {
  it("shifts by whole months", () => {
    expect(shiftMonths("2025-12-31", -12)).toBe("2024-12-31");
    expect(shiftMonths("2025-12-31", -60)).toBe("2020-12-31");
  });
});

describe("selectSystems", () => {
  it("drops non-community systems and orders by population", () => {
    const out = selectSystems([
      sys({ pwsid: "A", populationServed: 10 }),
      sys({ pwsid: "B", populationServed: 5000, kind: "other" }),
      sys({ pwsid: "C", populationServed: 900 }),
    ]);
    expect(out.map((s) => s.pwsid)).toEqual(["C", "A"]);
  });
  it("caps the number of systems, keeping the largest", () => {
    const many = Array.from({ length: 20 }, (_, i) => sys({ pwsid: `P${i}`, populationServed: i }));
    const out = selectSystems(many);
    expect(out).toHaveLength(5);
    expect(out[0]!.pwsid).toBe("P19");
  });
  it("returns empty when the ZIP has no community systems", () => {
    expect(selectSystems([sys({ kind: "other" })])).toEqual([]);
  });
});

describe("selectCityMatches (kept here with the other selection rules)", () => {
  it("keeps the largest plus comparably large systems", () => {
    const out = selectCityMatches([
      sys({ pwsid: "A", populationServed: 1_000_000 }),
      sys({ pwsid: "B", populationServed: 400_000 }),
      sys({ pwsid: "C", populationServed: 50_000 }),
    ]);
    expect(out.map((s) => s.pwsid)).toEqual(["A", "B"]);
  });
});
