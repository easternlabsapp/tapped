// The ONLY file that knows about waterviolations.org response shapes.
// Mapping derived from live responses (see test/fixtures):
//   GET /api/v1/zip/{zip}     -> { count, zip, systems: [{pwsid,name,population,type,violations,health_based,...}] | null }
//                                 400 {"error":"invalid zip code"} for malformed input; 200 with systems:null if none.
//                                 NOTE: matches on each system's registered address ZIP, not its service area.
//   GET /api/v1/system/{pwsid} -> { pwsid,name,population, violations_active, violations_active_health,
//                                 recent_violations: [{health_based, begin_date:"YYYY-MM-DD 00:00:00", status}] | null }
//                                 PWSID must be lowercase (uppercase 301-redirects).
// The API exposes no data-freshness field.

import {
  SourceError,
  type SourceAdapter,
  type SystemDetail,
  type SystemSummary,
} from "./types";

const BASE = "https://waterviolations.org/api/v1";
/** Last date covered by the source data. Bump on each quarterly refresh (and rebuild the system index with the same date). */
export const DATA_THROUGH_ISO = "2025-12-31";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const USER_AGENT = "Tapped/0.1 (+https://easternlabs.github.io)";

interface RawZipSystem {
  pwsid: string;
  name: string;
  population: number;
  type: string;
  violations: number;
  health_based: number;
  url?: string;
}
interface RawZip {
  systems: RawZipSystem[] | null;
}
interface RawSystem {
  violations_active?: number;
  violations_active_health?: number;
  url?: string;
  recent_violations: { health_based: boolean; begin_date: string }[] | null;
}

export interface WaterViolationsOptions {
  fetch?: typeof fetch;
  /** Pause between upstream calls to stay at a few requests/second. */
  minIntervalMs?: number;
  timeoutMs?: number;
}

export class WaterViolationsAdapter implements SourceAdapter {
  readonly sourceName = "EPA SDWIS via waterviolations.org";
  private readonly fetchFn: typeof fetch;
  private readonly minIntervalMs: number;
  private readonly timeoutMs: number;
  private lastCall = 0;

  constructor(opts: WaterViolationsOptions = {}) {
    this.fetchFn = opts.fetch ?? ((...a) => fetch(...a));
    this.minIntervalMs = opts.minIntervalMs ?? 300;
    this.timeoutMs = opts.timeoutMs ?? 8000;
  }

  async listSystems(zip: string): Promise<SystemSummary[]> {
    const res = await this.get(`/zip/${encodeURIComponent(zip)}`);
    // Upstream rejects some ZIPs it considers malformed; for us that means "not covered".
    if (res.status === 400 || res.status === 404) return [];
    const body = (await this.json(res)) as RawZip;
    return (body.systems ?? []).map((s) => ({
      pwsid: s.pwsid,
      name: s.name,
      populationServed: s.population ?? 0,
      kind: s.type === "Community Water System" ? "community" : "other",
      totalViolations: s.violations ?? 0,
      healthBasedViolations: s.health_based ?? 0,
      sourceUrl: s.url ?? null,
    }));
  }

  async getDetail(pwsid: string): Promise<SystemDetail> {
    const res = await this.get(`/system/${encodeURIComponent(pwsid.toLowerCase())}`);
    const body = (await this.json(res)) as RawSystem;
    return {
      violations: (body.recent_violations ?? []).map((v) => ({
        healthBased: v.health_based === true,
        beginDate: parseDate(v.begin_date),
      })),
      openHealthBased: body.violations_active_health ?? 0,
      openTotal: body.violations_active ?? 0,
      sourceUrl: body.url ?? null,
    };
  }

  readonly dataThrough = DATA_THROUGH_ISO;

  /**
   * The API has no freshness field. waterviolations.org states its violation
   * records run "through December 2025" (confirmed: latest end date in its CSVs
   * is 2025-12-31). UPDATE DATA_THROUGH_ISO when the site publishes a newer quarterly refresh.
   */
  dataAsOf(_now: Date): string {
    const [y, m] = DATA_THROUGH_ISO.split("-");
    return `${MONTHS[Number(m) - 1]} ${y}`;
  }

  /** The site redirects /system/{pwsid} to the system's full page. */
  systemUrl(pwsid: string): string {
    return `https://waterviolations.org/system/${pwsid.toLowerCase()}`;
  }

  private async get(path: string): Promise<Response> {
    const wait = this.lastCall + this.minIntervalMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastCall = Date.now();
    let res: Response;
    try {
      res = await this.fetchFn(BASE + path, {
        headers: { accept: "application/json", "user-agent": USER_AGENT },
        redirect: "follow",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      throw new SourceError(`waterviolations.org request failed: ${path}`, e);
    }
    if (!res.ok && res.status !== 400 && res.status !== 404) {
      throw new SourceError(`waterviolations.org returned HTTP ${res.status} for ${path}`);
    }
    if (res.status === 404 && path.startsWith("/system/")) {
      throw new SourceError(`waterviolations.org: system not found ${path}`);
    }
    return res;
  }

  private async json(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch (e) {
      throw new SourceError("waterviolations.org returned an unparseable body", e);
    }
  }
}

/** "2024-10-17 00:00:00" -> "2024-10-17"; anything unparseable -> null. */
function parseDate(raw: string | undefined): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(raw ?? "");
  return m && !Number.isNaN(Date.parse(m[1]!)) ? m[1]! : null;
}
