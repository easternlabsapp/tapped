import { placeForZip, nearestZips } from "../src/places";
import type { Geo } from "../src/service";

/** Real ZIP places and nearest-ZIP search, but no city matching. */
export const noCityGeo: Geo = { placeFor: placeForZip, cityCandidates: () => [], nearest: nearestZips };
