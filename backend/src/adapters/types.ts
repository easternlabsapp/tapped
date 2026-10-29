// Source-neutral interface. Everything a data source must provide.
// To swap sources (e.g. bulk EPA ECHO/SDWIS ingest), implement SourceAdapter
// and change one line in src/index.ts. Scoring and the endpoint never change.

export type SystemKind = "community" | "other";

/** One water system associated with a ZIP, with lifetime summary counts. */
/** b = bacteria, n = nitrate/nitrite, t = water-treatment failure (all urgent); g = long-term-exposure / other. */
export type ViolationClass = "b" | "n" | "t" | "g";

export interface HealthViolationFact {
  /** ISO date the violation began, or null when unknown. */
  date: string | null;
  /** null = the source could not say what kind of violation it was. */
  cls: ViolationClass | null;
  open: boolean;
}

/** Everything scoring needs to know about one system. Source-neutral. */
export interface SystemFacts {
  /** Health-based violations: every open one, plus any that began within the history window. */
  health: HealthViolationFact[];
  /** Monitoring/reporting violations that are still open. */
  openPaperwork: number;
  /** Monitoring/reporting violations that began in the 12 months before the data's end date. */
  paperwork12m: number;
}

export interface SystemSummary {
  pwsid: string;
  name: string;
  populationServed: number;
  kind: SystemKind;
  /** Lifetime violation counts as reported by the source (no dates). */
  totalViolations: number;
  healthBasedViolations: number;
  /** Public page for this system at the source, shown to users as the citation. */
  sourceUrl: string | null;
  /** Pre-computed facts (from the bundled index). When absent, facts come from `getDetail`. */
  facts?: SystemFacts;
}

export interface ViolationRecord {
  healthBased: boolean;
  /** ISO date (YYYY-MM-DD) the violation began, or null if the source gave none/unparseable. */
  beginDate: string | null;
}

/** Dated detail for one system. */
export interface SystemDetail {
  violations: ViolationRecord[];
  /** Count of unresolved health-based violations, as determined by the source. */
  openHealthBased: number;
  /** Count of unresolved violations of any kind. */
  openTotal: number;
  /** The system's public page at the source, when the detail record provides one. */
  sourceUrl?: string | null;
}

export interface SourceAdapter {
  /** Human-readable attribution, returned as `source` in the API. */
  readonly sourceName: string;
  /** Systems associated with a ZIP. Empty array when the ZIP is not covered. */
  listSystems(zip: string): Promise<SystemSummary[]>;
  getDetail(pwsid: string): Promise<SystemDetail>;
  /** Last date (YYYY-MM-DD) the source's data covers. All recency windows count back from here, not from today. */
  readonly dataThrough: string;
  /** Freshness label for the underlying EPA data, e.g. "December 2025". */
  dataAsOf(now: Date): string;
  /** Public page for a system at the source (our citation). */
  systemUrl(pwsid: string): string;
}

/** Thrown for any upstream failure (network, timeout, 5xx, unparseable body). */
export class SourceError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "SourceError";
  }
}
