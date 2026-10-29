// Finds a ZIP's city utility: the large water system(s) registered in the same
// city and state as the ZIP. Source-neutral: the index is plain data built by
// scripts/build-system-index.mjs.

import type { HealthViolationFact, SystemFacts, SystemSummary, ViolationClass } from "./adapters/types";
import { SYSTEM_INDEX } from "./data/systemIndex";
import type { Place } from "./places";

interface IndexedSystem {
  pwsid: string;
  name: string;
  city: string;
  population: number;
  /** Raw profile fields; parsed on demand so loading a state stays cheap. */
  health: string;
  openPaperwork: number;
  paperwork12m: number;
}

const parsedStates = new Map<string, IndexedSystem[]>();
function systemsInState(state: string): IndexedSystem[] {
  let list = parsedStates.get(state);
  if (!list) {
    list = (SYSTEM_INDEX[state] ?? "")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [pwsid, name, city, pop, health, openPw, pw12] = line.split("|");
        return {
          pwsid: pwsid!,
          name: name!,
          city: city!,
          population: Number(pop),
          health: health ?? "",
          openPaperwork: Number(openPw) || 0,
          paperwork12m: Number(pw12) || 0,
        };
      });
    parsedStates.set(state, list);
  }
  return list;
}

/** "St. Louis" == "Saint Louis", "Ft. Worth" == "Fort Worth", punctuation/case ignored. */
export function normalizeCity(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bst\.?(?=\s)/g, "saint")
    .replace(/\bmt\.?(?=\s)/g, "mount")
    .replace(/\bft\.?(?=\s)/g, "fort")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Hand-curated cases where the city utility is registered under another city.
 * Add rows as they are found. New York City's system is registered in Valhalla.
 */
const OVERRIDES: { state: string; zipPrefixes: string[]; pwsid: string }[] = [
  { state: "NY", zipPrefixes: ["100", "101", "102", "103", "104", "111", "112", "113", "114", "116"], pwsid: "NY7003493" },
];

/** "2024-03-01.b.o;2022-09-01.g.c" -> facts. A "?" date means the source gave none. */
function factsOf(s: IndexedSystem): SystemFacts {
  const health: HealthViolationFact[] = s.health
    ? s.health.split(";").map((part) => {
        const [date, cls, open] = part.split(".");
        return { date: date === "?" ? null : date!, cls: cls as ViolationClass, open: open === "o" };
      })
    : [];
  return { health, openPaperwork: s.openPaperwork, paperwork12m: s.paperwork12m };
}

/** Pre-computed scoring facts for a system in the bundled index; null if it is not indexed. */
export function indexedFacts(pwsid: string): SystemFacts | null {
  const hit = systemsInState(pwsid.slice(0, 2).toUpperCase()).find((s) => s.pwsid === pwsid);
  return hit ? factsOf(hit) : null;
}

function summarize(s: IndexedSystem): SystemSummary {
  return {
    pwsid: s.pwsid,
    name: s.name,
    populationServed: s.population,
    kind: "community",
    // The index is built from violation records, so every entry has at least one.
    totalViolations: 1,
    healthBasedViolations: 0,
    sourceUrl: null, // the service fills this from the adapter
    facts: factsOf(s),
  };
}

/** Systems registered in the ZIP's city, largest first. Empty if none. */
export function cityCandidates(place: Place): SystemSummary[] {
  const systems = systemsInState(place.state);
  const override = OVERRIDES.find((o) => o.state === place.state && o.zipPrefixes.some((p) => place.zip.startsWith(p)));
  if (override) {
    const hit = systems.find((s) => s.pwsid === override.pwsid);
    if (hit) return [summarize(hit)];
  }
  const city = normalizeCity(place.city);
  return systems
    .filter((s) => normalizeCity(s.city) === city)
    .sort((a, b) => b.population - a.population)
    .map(summarize);
}
