// The public API contract. The iOS app depends only on these shapes.
// Nothing in here may reference a specific data source.

export type Status = "green" | "yellow" | "red" | "unknown";

export interface SystemResult {
  pwsid: string;
  name: string;
  populationServed: number;
  status: Status;
  /** Link to this system's record at the data source (our citation). */
  sourceUrl: string | null;
}

export interface StatusResponse {
  status: Status;
  summary: string;
  systems: SystemResult[];
  dataAsOf: string; // freshness of the EPA data, not a test date
  multipleSystems: boolean;
  source: string;
  // Set when the requested ZIP had no records and we used the closest ZIP that does.
  nearby: { zip: string; distanceMiles: number } | null;
  note: string | null; // display text explaining `nearby`
  // Additive to the original contract: the required "not a guarantee" line.
  disclaimer: string;
}

export interface ApiError {
  error: { code: "invalid_zip" | "not_found" | "method_not_allowed" | "upstream_unavailable"; message: string };
}
