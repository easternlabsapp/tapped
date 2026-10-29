# Deployment and operations

## Prerequisites

- A Cloudflare account (free plan is sufficient).
- Node.js 20+.
- For the iOS release: an Apple Developer Program membership (see [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)).

## Deploy the API

```bash
cd backend
npm install
npx wrangler login                               # opens a browser to authorize
npx wrangler kv namespace create STATUS_CACHE    # prints a namespace id
```

Set the printed id in `backend/wrangler.toml` (`[[kv_namespaces]]` → `id`), then:

```bash
npm test && npm run typecheck
npm run deploy
```

Wrangler prints the public URL (`https://tapped-api.<account>.workers.dev`). Verify:

```bash
curl "https://tapped-api.<account>.workers.dev/status?zip=21202"
curl -i "https://tapped-api.<account>.workers.dev/status?zip=abc"   # expect HTTP 400
```

Then set the production URL in `ios/Tapped/Config.swift` (the `#else` branch) and rebuild the app.

## Operational parameters

| Setting | Location | Default |
|---|---|---|
| Cache lifetime | `CACHE_TTL_SECONDS` in `wrangler.toml` | 259200 (3 days) |
| Data end date | `DATA_THROUGH_ISO` in `backend/src/adapters/waterviolations.ts` | `2025-12-31` |
| Scoring version | `SCORING_VERSION` in `backend/src/scoring.ts` | see file |

## Quarterly data refresh

The bundled system index is a snapshot of the source's per-state downloads. Refresh when the source publishes a new quarter:

```bash
cd backend
node scripts/build-system-index.mjs --data-end YYYY-MM-DD    # downloads 50 state files; several minutes
```

1. Set `DATA_THROUGH_ISO` to the same date (a test fails if the two disagree).
2. Increment `SCORING_VERSION` so cached responses are discarded.
3. Run `npm test`, then `npm run deploy`.

No application release is required: the app displays whatever the API returns.

The ZIP place table (`scripts/build-zip-places.mjs`, input from `https://download.geonames.org/export/zip/US.zip`) changes rarely and needs refreshing only occasionally.

## Monitoring

- `npx wrangler tail` streams live request logs and errors.
- Upstream failures return HTTP 502 and are logged with the cause; they are never cached.
- The Cloudflare dashboard shows request volume against the free-plan daily limit (100,000 requests).

## Rollback

`npx wrangler rollback` restores the previous deployment. If cached responses must be discarded as well, increment `SCORING_VERSION` and deploy.
