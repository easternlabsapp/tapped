# Architecture

## Goals

- A thin client: the application depends only on the project's own API.
- A stable response contract that does not change when the data source does.
- Zero fixed hosting cost at low and moderate volume.
- Privacy by construction: the API receives a five-digit ZIP code and nothing else.

## Request flow

```mermaid
sequenceDiagram
    participant App as iOS app
    participant W as Worker (/status)
    participant K as Workers KV
    participant S as Source (waterviolations.org)
    App->>App: Location -> ZIP (CoreLocation + CLGeocoder, on device)
    App->>W: GET /status?zip=21202
    W->>W: Validate ZIP
    W->>K: Cached response?
    alt cache hit
        K-->>W: Response
    else cache miss
        W->>W: ZIP -> city, state (bundled table)
        W->>S: List systems for ZIP
        W->>W: Select systems; read facts from bundled index
        opt system not in bundled index
            W->>S: System detail
        end
        W->>W: Score, build summary
        W->>K: Store (3-day TTL)
    end
    W-->>App: JSON response
```

## Backend modules

| Module | Role |
|---|---|
| `index.ts` | Routing, input validation, caching, error mapping. Dependencies are injected for testing. |
| `service.ts` | Orchestration: choose systems, obtain facts, score, assemble the response. |
| `scoring.ts` | Scoring rules and selection thresholds. Pure functions over source-neutral facts. |
| `copy.ts` | All user-facing wording, including the required disclaimer. |
| `facts.ts` | Converts a live source record into scoring facts. |
| `cityMatch.ts` | City-level system lookup and bundled violation profiles. |
| `places.ts` | ZIP to place lookup (binary search over a sorted string) and nearest-ZIP search. |
| `cache.ts` | KV-backed response cache with a versioned key. |
| `adapters/` | `SourceAdapter` interface and the waterviolations.org implementation. |
| `data/` | Generated, bundled datasets (do not edit by hand). |

### Source adapter boundary

All knowledge of the source's response shapes lives in `adapters/waterviolations.ts`. Replacing the source (for example, ingesting EPA ECHO/SDWIS bulk files directly) requires a new class implementing `SourceAdapter` and a one-line change in `index.ts`. Scoring, wording, and the API contract are unaffected.

## Cost and limits

The design targets the Cloudflare Workers free tier: bundle size is under 1 MB compressed (limit 3 MB), the heaviest request path uses roughly 1 to 3 ms of CPU (the free-tier limit is about 10 ms), and results are cached for three days, so most requests do not reach the source. The source asks callers to keep requests to a few per second; the adapter spaces upstream calls accordingly.

## Client

The SwiftUI client targets iOS 17. `LookupViewModel` holds the state machine (idle, locating, loading, result, permission denied, location unavailable, not covered, error). Location, geocoding, place naming, and the API client are behind small protocols so they can be substituted in tests. The Locate control animates into the status indicator after a result; red, yellow, and green are reserved for status.

## Caching and versioning

Cached responses are keyed by `status:v{SCORING_VERSION}:{zip}`. Changing scoring behavior requires incrementing `SCORING_VERSION` so stale answers are not served.
