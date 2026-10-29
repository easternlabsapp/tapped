import type { StatusResponse } from "./contract";
import { SCORING_VERSION } from "./scoring";

export interface StatusCache {
  get(zip: string): Promise<StatusResponse | null>;
  put(zip: string, value: StatusResponse): Promise<void>;
}

// Versioned key: bumping SCORING_VERSION invalidates old results immediately.
const key = (zip: string) => `status:v${SCORING_VERSION}:${zip}`;

export class KvStatusCache implements StatusCache {
  constructor(private readonly kv: KVNamespace, private readonly ttlSeconds: number) {}

  async get(zip: string): Promise<StatusResponse | null> {
    return this.kv.get<StatusResponse>(key(zip), "json");
  }

  async put(zip: string, value: StatusResponse): Promise<void> {
    await this.kv.put(key(zip), JSON.stringify(value), { expirationTtl: this.ttlSeconds });
  }
}
