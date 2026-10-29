// Turns a live source detail record into scoring facts. The live API does not say
// what kind of violation each one was, so classes are unknown (null) here;
// bundled index entries (cityMatch.ts) carry classes.

import type { SystemDetail, SystemFacts } from "./adapters/types";
import { shiftMonths } from "./dates";
import { SCORING_CONFIG } from "./scoring";

export function factsFromDetail(detail: SystemDetail, anchor: string): SystemFacts {
  const historyStart = shiftMonths(anchor, -12 * SCORING_CONFIG.historyYears);
  const paperworkStart = shiftMonths(anchor, -SCORING_CONFIG.paperworkWindowMonths);

  const health = detail.violations
    .filter((v) => v.healthBased && (v.beginDate === null || v.beginDate >= historyStart))
    .map((v) => ({ date: v.beginDate, cls: null, open: false }));
  // The source reports how many health-based violations are open, not which ones.
  for (let i = 0; i < detail.openHealthBased; i++) health.push({ date: null, cls: null, open: true });

  return {
    health,
    openPaperwork: Math.max(0, detail.openTotal - detail.openHealthBased),
    paperwork12m: detail.violations.filter(
      (v) => !v.healthBased && v.beginDate !== null && v.beginDate >= paperworkStart && v.beginDate <= anchor,
    ).length,
  };
}
