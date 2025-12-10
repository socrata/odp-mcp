import type { HttpClient } from '../httpClient.js';
import { LruCache } from '../cache.js';
import { authFromInput, type AuthOverrideInput } from '../auth.js';

export interface GetMetadataInput extends AuthOverrideInput {
  domain: string;
  uid: string; // dataset identifier
}

export interface GetMetadataOptions {
  cacheTtlMs?: number;
}

// Default TTL: 5 minutes (matches ServerConfig.cacheTtlMs default)
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

let metadataCache: LruCache<string, unknown> | null = null;
let currentTtlMs = DEFAULT_CACHE_TTL_MS;

function getCache(ttlMs?: number): LruCache<string, unknown> {
  const normalizedTtl = typeof ttlMs === 'number' && Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : DEFAULT_CACHE_TTL_MS;
  if (!metadataCache || normalizedTtl !== currentTtlMs) {
    metadataCache = new LruCache<string, unknown>(100, normalizedTtl);
    currentTtlMs = normalizedTtl;
  }
  return metadataCache;
}

export async function getMetadata(client: HttpClient, input: GetMetadataInput, options?: GetMetadataOptions) {
  // SODA metadata via /api/views/<uid>
  const cacheKey = `${input.domain}:${input.uid}`;
  const cache = getCache(options?.cacheTtlMs);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const path = `/api/views/${input.uid}.json`;
  const authOverride = authFromInput(input);
  const response = await client.request({ method: 'GET', path, authOverride });
  cache.set(cacheKey, response);
  return response;
}
