// User-facing wording. This is compliance-record data, NOT a fresh lab test:
// never imply a recent water test happened, and never say the water "is safe".
// Keep all wording here.

import type { Status } from "./contract";
import type { ViolationClass } from "./adapters/types";
import { monthYear } from "./dates";
import type { Scored } from "./scoring";
import { SCORING_CONFIG } from "./scoring";

export const DISCLAIMER =
  "Based on EPA compliance records, not a recent water test. This is not a guarantee that the water is safe to drink.";

const URGENT_LABEL: Record<Exclude<ViolationClass, "g">, string> = {
  b: "bacteria",
  n: "nitrate",
  t: "a water-treatment failure",
};

export function summarize(args: {
  status: Status;
  scored: Scored | null;
  dataAsOf: string;
  multipleSystems: boolean;
}): string {
  const asOf = `(EPA data as of ${args.dataAsOf})`;
  const months = SCORING_CONFIG.healthWindowMonths;
  const s = args.scored;
  const since = s?.detail.date ? ` since ${monthYear(s.detail.date)}` : "";
  let core: string;
  switch (s?.reason) {
    case "clean": {
      core = `No health-based violations on record in the last ${months} months of EPA data, and none open ${asOf}.`;
      if (s.detail.historyDate) core += ` An earlier health-based violation began in ${monthYear(s.detail.historyDate)}.`;
      const minor = s.detail.minorPaperwork ?? 0;
      if (minor > 0) core += ` ${minor} monitoring or reporting ${minor === 1 ? "violation was" : "violations were"} also recorded.`;
      break;
    }
    case "paperwork_pattern":
      core = `No recent health-based violations, but open or repeated monitoring and reporting violations mean some testing may not have been verified ${asOf}.`;
      break;
    case "recent_health":
      core = `A health-based violation began ${s.detail.date ? `in ${monthYear(s.detail.date)}` : "recently"} (within the last ${months} months of EPA data); none currently open ${asOf}.`;
      break;
    case "open_longterm":
      core = `An open health-based violation for a long-term-exposure issue has been on record${since} ${asOf}. These generally matter more to residents than to short visits.`;
      break;
    case "open_urgent": {
      const cls = s.detail.cls;
      const what = cls && cls !== "g" ? ` involving ${URGENT_LABEL[cls]}` : "";
      core = `An open health-based violation${what} has been on record${since} ${asOf}. Check with the local water utility before drinking.`;
      break;
    }
    default:
      core = `No water system records found for this ZIP code ${asOf}.`;
  }
  return args.multipleSystems ? `${core} Multiple water systems are associated with this ZIP; showing the worst result.` : core;
}

export function nearbyNote(requestedZip: string, nearbyZip: string, miles: number): string {
  const dist = miles < 1 ? "less than a mile" : `about ${Math.round(miles)} ${Math.round(miles) === 1 ? "mile" : "miles"}`;
  return `No water system records for ZIP ${requestedZip}. Showing the closest ZIP with records, ${nearbyZip} (${dist} away); it may not be the system that serves you.`;
}

export function cityNote(requestedZip: string, city: string, state: string): string {
  return `No water system is registered to ZIP ${requestedZip}. Showing the main water system registered in ${city}, ${state}; it may not be the one that serves your address.`;
}
