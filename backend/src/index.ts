import type { ApiError } from "./contract";
import { SourceError, type SourceAdapter } from "./adapters/types";
import { WaterViolationsAdapter } from "./adapters/waterviolations";
import { KvStatusCache, type StatusCache } from "./cache";
import { buildStatus, defaultGeo, type Geo } from "./service";
import { parseZip } from "./zip";

export interface Env {
  STATUS_CACHE: KVNamespace;
  CACHE_TTL_SECONDS?: string;
}

export interface Deps {
  adapter: SourceAdapter;
  cache: StatusCache;
  now: () => Date;
  geo?: Geo;
}

const DEFAULT_TTL = 3 * 24 * 60 * 60; // data changes quarterly: cache for days

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });
}

function err(status: number, code: ApiError["error"]["code"], message: string): Response {
  return json({ error: { code, message } } satisfies ApiError, status);
}

export async function handle(request: Request, deps: Deps): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname !== "/status") return err(404, "not_found", "Not found.");
  if (request.method !== "GET") return err(405, "method_not_allowed", "Use GET.");

  const zip = parseZip(url.searchParams.get("zip"));
  if (!zip) return err(400, "invalid_zip", "zip must be a 5-digit US ZIP code.");

  const cached = await deps.cache.get(zip);
  if (cached) return json(cached, 200, { "cache-control": "public, max-age=3600", "x-cache": "HIT" });

  try {
    const result = await buildStatus(zip, deps.adapter, deps.now(), deps.geo ?? defaultGeo);
    await deps.cache.put(zip, result); // errors are never cached
    return json(result, 200, { "cache-control": "public, max-age=3600", "x-cache": "MISS" });
  } catch (e) {
    if (e instanceof SourceError) {
      console.error("source error", e.message, e.cause);
      return err(502, "upstream_unavailable", "Water data is temporarily unavailable. Please try again later.");
    }
    throw e;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const ttl = Number(env.CACHE_TTL_SECONDS) || DEFAULT_TTL;
    return handle(request, {
      adapter: new WaterViolationsAdapter(), // <- the one line to change when swapping sources
      cache: new KvStatusCache(env.STATUS_CACHE, ttl),
      now: () => new Date(),
    });
  },
};
