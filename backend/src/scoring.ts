// ALL tunable scoring rules live in this file (violation classes live in
// scripts/violation-classes.mjs). Source-neutral: works on the facts defined in
// adapters/types.ts.
//
// Every recency window counts back from the data's END DATE (`anchor`), never from
// today: the source data lags by months, so windows measured from today would
// contain nothing and every system would look clean.
//
//   red     an OPEN health-based violation of an urgent type (bacteria, nitrate, treatment
//           failure), or of unknown type, that began within `urgentOpenWindowMonths`. An older
//           open record cannot be shown to still be active (the source often never closes
//           old entries), so it is yellow, not red.
//   yellow  an open long-term-type health-based violation; an open urgent-type violation
//           older than the window; any health-based violation that
//           began in the last `healthWindowMonths`; an open monitoring/reporting violation,
//           or `paperworkPatternCount`+ of them in the last `paperworkWindowMonths`
//   green   none of the above (older history is mentioned in the summary, color unchanged)

import type { Status } from "./contract";
import type { SystemFacts, SystemSummary, ViolationClass } from "./adapters/types";
import { shiftMonths } from "./dates";

export const SCORING_VERSION = 7; // bump to invalidate cached results when rules change

export const SCORING_CONFIG = {
  /** A health-based violation that began this recently makes the result yellow, even if resolved. */
  healthWindowMonths: 12,
  /** An open urgent-type violation only makes the result red if it began this recently. */
  urgentOpenWindowMonths: 12,
  /** Older health-based violations (up to this many years) are only mentioned, not scored. */
  historyYears: 5,
  /** This many monitoring/reporting violations in the window make the result yellow. */
  paperworkPatternCount: 3,
  paperworkWindowMonths: 12,
  /**
   * Only score community water systems (the ones that supply homes). The
   * source's ZIP lookup also returns restaurants, campgrounds, power plants,
   * etc. that would otherwise dominate the "worst status".
   * If a ZIP has no community systems, it scores as "unknown".
   */
  communityOnly: true,
  /**
   * Score at most this many systems per ZIP, largest population first. Some
   * ZIPs map to 100+ systems; "worst of everything" would be meaningless.
   */
  maxSystems: 5,
  /**
   * When a ZIP has no scoreable systems, fall back to the closest ZIPs that do.
   * At most `nearbyMaxAttempts` ZIPs within `nearbyMaxMiles` are tried, nearest first.
   */
  nearbyMaxMiles: 20,
  nearbyMaxAttempts: 10,
  /**
   * City matching: score the water system(s) registered in the ZIP's own city.
   * Besides the largest one, include others serving at least this share of its
   * population (up to cityMaxSystems), so a city with two big utilities isn't half-ignored.
   */
  citySecondarySystemShare: 0.2,
  cityMaxSystems: 3,
};

export type Reason = "open_urgent" | "open_old_urgent" | "open_longterm" | "recent_health" | "paperwork_pattern" | "clean";

export interface Scored {
  status: Exclude<Status, "unknown">;
  reason: Reason;
  /** What the summary needs to describe the result. */
  detail: {
    /** open_urgent: the kind of violation (null = unknown). */
    cls?: ViolationClass | null;
    /** open_*: earliest date an open violation began; recent_health: latest date. */
    date?: string | null;
    /** clean: latest older health-based violation, mentioned as history. */
    historyDate?: string | null;
    /** clean: a few monitoring/reporting violations that did not reach the pattern threshold. */
    minorPaperwork?: number;
  };
}

/** Pick which systems to score (and therefore which need a detail fetch). */
export function selectSystems(all: SystemSummary[]): SystemSummary[] {
  return all
    .filter((s) => !SCORING_CONFIG.communityOnly || s.kind === "community")
    .sort((a, b) => b.populationServed - a.populationServed)
    .slice(0, SCORING_CONFIG.maxSystems);
}

/** From a city's systems (largest first), pick the ones to score. */
export function selectCityMatches(candidates: SystemSummary[]): SystemSummary[] {
  const top = candidates[0];
  if (!top) return [];
  return candidates
    .filter((c) => c === top || c.populationServed >= top.populationServed * SCORING_CONFIG.citySecondarySystemShare)
    .slice(0, SCORING_CONFIG.cityMaxSystems);
}

/** True when the summary alone proves there is nothing to score. */
export function hasNoViolationsOnRecord(s: SystemSummary): boolean {
  return s.totalViolations === 0 && s.healthBasedViolations === 0;
}

const earliest = (dates: (string | null)[]) => dates.filter((d): d is string => d !== null).sort()[0] ?? null;
const latest = (dates: (string | null)[]) => dates.filter((d): d is string => d !== null).sort().at(-1) ?? null;

/** `anchor` is the last date the data covers (YYYY-MM-DD), NOT today. */
export function scoreSystem(facts: SystemFacts | null, anchor: string): Scored {
  if (!facts) return { status: "green", reason: "clean", detail: {} };

  const open = facts.health.filter((h) => h.open);
  const urgent = open.filter((h) => h.cls !== "g"); // unknown type counts as urgent: err on the side of caution
  const urgentStart = shiftMonths(anchor, -SCORING_CONFIG.urgentOpenWindowMonths);
  // A missing date counts as recent: don't silently drop a violation.
  const freshUrgent = urgent.filter((h) => h.date === null || h.date >= urgentStart);
  if (freshUrgent.length > 0) {
    const known = freshUrgent.find((h) => h.cls !== null);
    return {
      status: "red",
      reason: "open_urgent",
      detail: { cls: known?.cls ?? null, date: earliest(freshUrgent.map((h) => h.date)) },
    };
  }

  // Urgent-type but older than the window: still on record as open, but not shown to be active.
  const oldUrgent = urgent.filter((h) => !freshUrgent.includes(h));
  if (oldUrgent.length > 0) {
    const known = oldUrgent.find((h) => h.cls !== null);
    return {
      status: "yellow",
      reason: "open_old_urgent",
      detail: { cls: known?.cls ?? null, date: earliest(oldUrgent.map((h) => h.date)) },
    };
  }

  if (open.length > 0) {
    return { status: "yellow", reason: "open_longterm", detail: { date: earliest(open.map((h) => h.date)) } };
  }

  const windowStart = shiftMonths(anchor, -SCORING_CONFIG.healthWindowMonths);
  // A missing date counts as recent: don't silently drop a violation.
  const recent = facts.health.filter((h) => h.date === null || h.date >= windowStart);
  if (recent.length > 0) {
    return { status: "yellow", reason: "recent_health", detail: { date: latest(recent.map((h) => h.date)) } };
  }

  if (facts.openPaperwork > 0 || facts.paperwork12m >= SCORING_CONFIG.paperworkPatternCount) {
    return { status: "yellow", reason: "paperwork_pattern", detail: {} };
  }

  return {
    status: "green",
    reason: "clean",
    detail: {
      historyDate: latest(facts.health.map((h) => h.date)),
      minorPaperwork: facts.paperwork12m,
    },
  };
}

const SEVERITY: Record<Scored["status"], number> = { green: 0, yellow: 1, red: 2 };

/** Worst of several systems. Returns null when there is nothing to combine. */
export function worst(scored: Scored[]): Scored | null {
  let out: Scored | null = null;
  for (const s of scored) {
    if (!out || SEVERITY[s.status] > SEVERITY[out.status]) out = s;
  }
  return out;
}
