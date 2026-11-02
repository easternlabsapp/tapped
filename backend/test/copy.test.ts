import { describe, expect, it } from "vitest";
import { DISCLAIMER, summarize } from "../src/copy";
import { scoreSystem, type Scored } from "../src/scoring";
import type { HealthViolationFact, SystemFacts } from "../src/adapters/types";

const ANCHOR = "2025-12-31";
const AS_OF = "December 2025";
const facts = (p: Partial<SystemFacts> = {}): SystemFacts => ({ health: [], openPaperwork: 0, paperwork12m: 0, ...p });
const hv = (p: Partial<HealthViolationFact>): HealthViolationFact => ({ date: "2024-01-01", cls: "g", open: false, ...p });
const text = (f: SystemFacts | null, multi = false) => {
  const scored = scoreSystem(f, ANCHOR);
  return summarize({ status: scored.status, scored, dataAsOf: AS_OF, multipleSystems: multi });
};

describe("summaries", () => {
  it("clean", () => {
    expect(text(facts())).toBe("No health-based violations on record in the last 12 months of EPA data, and none open (EPA data as of December 2025).");
  });
  it("clean with history and minor paperwork", () => {
    const t = text(facts({ health: [hv({ date: "2022-09-01", cls: "b" })], paperwork12m: 1 }));
    expect(t).toContain("An earlier health-based violation began in Sep 2022.");
    expect(t).toContain("1 monitoring or reporting violation was also recorded.");
  });
  it("recent resolved health-based violation", () => {
    expect(text(facts({ health: [hv({ date: "2025-06-10" })] }))).toContain("began in Jun 2025");
  });
  it("open urgent names the kind and the start, and points to the utility", () => {
    const t = text(facts({ health: [hv({ open: true, cls: "b", date: "2025-03-01" })] }));
    expect(t).toContain("involving bacteria");
    expect(t).toContain("since Mar 2025");
    expect(t).toContain("Check with the local water utility before drinking.");
  });
  it("open urgent of unknown type still reads sensibly", () => {
    expect(text(facts({ health: [hv({ open: true, cls: null, date: null })] }))).toMatch(/^An open health-based violation has been on record \(EPA data/);
  });
  it("open long-term is framed for short visits without dismissing it", () => {
    const t = text(facts({ health: [hv({ open: true, cls: "g", date: "2017-02-01" })] }));
    expect(t).toContain("since Feb 2017");
    expect(t).toContain("generally matter more to residents than to short visits");
  });
  it("old open urgent says it is not shown to be active, and never reads as an alarm", () => {
    const t = text(facts({ health: [hv({ open: true, cls: "t", date: "2017-12-18" })] }));
    expect(t).toContain("involving a water-treatment failure");
    expect(t).toContain("since Dec 2017");
    expect(t).toContain("do not show whether it is still active");
    expect(t).not.toContain("before drinking");
  });
  it("paperwork pattern", () => {
    expect(text(facts({ openPaperwork: 1 }))).toContain("some testing may not have been verified");
  });
  it("unknown", () => {
    expect(summarize({ status: "unknown", scored: null, dataAsOf: AS_OF, multipleSystems: false })).toContain("No water system records found");
  });
  it("multiple systems adds the worst-result note", () => {
    expect(text(facts(), true)).toContain("showing the worst result");
  });

  it("no summary or disclaimer ever claims safety or a fresh test", () => {
    const scenarios: (SystemFacts | null)[] = [
      null, facts(), facts({ openPaperwork: 2 }), facts({ paperwork12m: 4 }),
      facts({ health: [hv({ date: "2025-08-01" })] }),
      facts({ health: [hv({ open: true, cls: "g" })] }),
      facts({ health: [hv({ open: true, cls: "n" })] }),
      facts({ health: [hv({ open: true, cls: "t" })] }),
    ];
    for (const f of scenarios) expect(text(f)).not.toMatch(/\btested\b|test result|\bis safe\b|\bsafe to drink\b|tested safe/i);
    expect(DISCLAIMER).toMatch(/not a recent water test/);
    expect(DISCLAIMER).toMatch(/not a guarantee/);
  });
});

// Type-level check that Scored.detail is what copy relies on
const _typecheck: Scored["detail"] = {};
void _typecheck;
