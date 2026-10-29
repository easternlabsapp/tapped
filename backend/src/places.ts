// ZIP -> place (city, state, coordinates), and nearest-ZIP search.
// Data: GeoNames postal codes (CC BY 4.0), see src/data/zipPlaces.ts.
// The table is one sorted string; lookups binary-search it instead of parsing
// all ~41k rows, which keeps CPU use tiny on cold starts.

import { ZIP_PLACES } from "./data/zipPlaces";

export interface Place {
  zip: string;
  lat: number;
  lon: number;
  state: string; // e.g. "MD"
  city: string; // e.g. "Baltimore"
}

function parseLine(line: string): Place {
  const [zip, lat, lon, state, city] = line.split("|");
  return { zip: zip!, lat: Number(lat), lon: Number(lon), state: state!, city: city! };
}

export function placeForZip(zip: string): Place | null {
  const s = ZIP_PLACES;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const start = s.lastIndexOf("\n", mid) + 1;
    const key = s.substr(start, 5);
    if (key === zip) {
      const end = s.indexOf("\n", start);
      return parseLine(s.slice(start, end === -1 ? undefined : end));
    }
    if (key < zip) {
      const next = s.indexOf("\n", start);
      if (next === -1) return null;
      lo = next + 1;
    } else {
      hi = start;
    }
  }
  return null;
}

const EARTH_RADIUS_MILES = 3958.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}

export interface NearbyZip {
  zip: string;
  distanceMiles: number;
}

/** Nearest ZIPs to `zip` (excluding itself) within maxMiles, closest first. Empty if `zip` is unknown. */
export function nearestZips(zip: string, limit: number, maxMiles: number): NearbyZip[] {
  const origin = placeForZip(zip);
  if (!origin) return [];
  // Cheap latitude prefilter (1 degree is ~69 miles). Scans the table in place,
  // without splitting it into 41k strings, to keep CPU use small.
  const dLat = maxMiles / 69;
  const table = ZIP_PLACES;
  const out: NearbyZip[] = [];
  let start = 0;
  while (start < table.length) {
    let end = table.indexOf("\n", start);
    if (end === -1) end = table.length;
    const p1 = start + 6; // after "zzzzz|"
    const p2 = table.indexOf("|", p1);
    const lat = +table.slice(p1, p2);
    if (Math.abs(lat - origin.lat) <= dLat) {
      const z = table.substr(start, 5);
      if (z !== zip) {
        const p3 = table.indexOf("|", p2 + 1);
        const d = distanceMiles(origin.lat, origin.lon, lat, +table.slice(p2 + 1, p3));
        if (d <= maxMiles) out.push({ zip: z, distanceMiles: d });
      }
    }
    start = end + 1;
  }
  out.sort((a, b) => a.distanceMiles - b.distanceMiles);
  // PO-box and single-building ZIPs share one coordinate; keep one per spot so
  // they don't use up every fallback attempt on the same place.
  const seen = new Set<number>();
  return out.filter((n) => !seen.has(Math.round(n.distanceMiles * 1000)) && !!seen.add(Math.round(n.distanceMiles * 1000))).slice(0, limit);
}
