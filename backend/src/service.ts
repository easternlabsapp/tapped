// Orchestration: adapter -> pick systems -> score -> normalized response.
// Source-neutral; knows nothing about waterviolations.org.
//
// Which systems represent a ZIP, in order of preference:
//   1. ZIP systems that are also registered in the ZIP's city (direct, no caveat)
//   2. the main water system registered in the ZIP's city (note shown)
//   3. the largest community systems the source lists for the ZIP
//   4. the closest nearby ZIP that has 1 or 2 (note shown; never 3)

import type { StatusResponse, SystemResult } from "./contract";
import type { SourceAdapter, SystemSummary } from "./adapters/types";
import { DISCLAIMER, cityNote, nearbyNote, summarize } from "./copy";
import { cityCandidates, indexedFacts } from "./cityMatch";
import { factsFromDetail } from "./facts";
import { nearestZips, placeForZip, type NearbyZip, type Place } from "./places";
import {
  SCORING_CONFIG,
  hasNoViolationsOnRecord,
  scoreSystem,
  selectCityMatches,
  selectSystems,
  worst,
  type Scored,
} from "./scoring";

/** Geographic lookups, injectable so tests don't depend on the bundled datasets. */
export interface Geo {
  placeFor(zip: string): Place | null;
  cityCandidates(place: Place): SystemSummary[];
  nearest(zip: string, limit: number, maxMiles: number): NearbyZip[];
}

export const defaultGeo: Geo = { placeFor: placeForZip, cityCandidates, nearest: nearestZips };

type Via = "zip" | "city";

/**
 * `strict` skips preference 3 (arbitrary small systems listed for the ZIP). It is
 * used for nearby ZIPs, where only a city utility or direct match is trustworthy
 * enough to show for a different ZIP.
 */
async function pickSystems(zip: string, adapter: SourceAdapter, geo: Geo, strict = false): Promise<{ systems: SystemSummary[]; via: Via; place: Place | null }> {
  const place = geo.placeFor(zip);
  const cityPick = place ? selectCityMatches(geo.cityCandidates(place)) : [];
  const fromZip = await adapter.listSystems(zip);

  const cityIds = new Set(cityPick.map((c) => c.pwsid));
  const direct = fromZip.filter((s) => cityIds.has(s.pwsid));
  if (direct.length > 0) return { systems: direct, via: "zip", place };
  if (cityPick.length > 0) return { systems: cityPick, via: "city", place };
  return { systems: strict ? [] : selectSystems(fromZip), via: "zip", place };
}

async function scoreSystems(selected: SystemSummary[], adapter: SourceAdapter, now: Date) {
  const anchor = adapter.dataThrough;
  const systems: SystemResult[] = [];
  const scored: Scored[] = [];
  for (const s of selected) {
    // Facts, best source first: already attached (city match), the bundled index (no network),
    // nothing on record (skip the call), or the live detail record.
    let facts = s.facts ?? indexedFacts(s.pwsid);
    let sourceUrl = s.sourceUrl ?? (facts ? adapter.systemUrl(s.pwsid) : null);
    if (!facts && !hasNoViolationsOnRecord(s)) {
      const detail = await adapter.getDetail(s.pwsid);
      facts = factsFromDetail(detail, anchor);
      sourceUrl = detail.sourceUrl ?? sourceUrl;
    }
    const result = scoreSystem(facts, anchor);
    scored.push(result);
    systems.push({ pwsid: s.pwsid, name: s.name, populationServed: s.populationServed, status: result.status, sourceUrl });
  }
  return { systems, overall: worst(scored) };
}

export async function buildStatus(zip: string, adapter: SourceAdapter, now: Date, geo: Geo = defaultGeo): Promise<StatusResponse> {
  const dataAsOf = adapter.dataAsOf(now);
  const first = await pickSystems(zip, adapter, geo);
  let { systems, overall } = await scoreSystems(first.systems, adapter, now);
  let nearby: StatusResponse["nearby"] = null;
  let note: string | null = null;
  if (overall && first.via === "city" && first.place) note = cityNote(zip, first.place.city, first.place.state);

  if (!overall) {
    for (const c of geo.nearest(zip, SCORING_CONFIG.nearbyMaxAttempts, SCORING_CONFIG.nearbyMaxMiles)) {
      const attempt = await pickSystems(c.zip, adapter, geo, true);
      const scoredAttempt = await scoreSystems(attempt.systems, adapter, now);
      if (scoredAttempt.overall) {
        ({ systems, overall } = scoredAttempt);
        nearby = { zip: c.zip, distanceMiles: Math.round(c.distanceMiles * 10) / 10 };
        note = nearbyNote(zip, c.zip, nearby.distanceMiles);
        break;
      }
    }
  }

  const multipleSystems = systems.length > 1;
  const status = overall?.status ?? "unknown";
  return {
    status,
    summary: summarize({ status, scored: overall, dataAsOf, multipleSystems }),
    systems,
    dataAsOf,
    multipleSystems,
    source: adapter.sourceName,
    nearby,
    note,
    disclaimer: DISCLAIMER,
  };
}
