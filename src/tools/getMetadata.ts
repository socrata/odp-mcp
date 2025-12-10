import type { HttpClient } from '../httpClient.js';
import { LruCache } from '../cache.js';
import { authFromInput, type AuthOverrideInput } from '../auth.js';

export interface GetMetadataInput extends AuthOverrideInput {
  domain: string;
  uid: string; // dataset identifier
}

// Default TTL: 5 minutes (matches ServerConfig.cacheTtlMs default)
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const metadataCache = new LruCache<string, unknown>(100, DEFAULT_CACHE_TTL_MS);

export async function getMetadata(client: HttpClient, input: GetMetadataInput) {
  // SODA metadata via /api/views/<uid>
  const cacheKey = `${input.domain}:${input.uid}`;
  const cached = metadataCache.get(cacheKey);
  if (cached) return cached;

  const path = `/api/views/${input.uid}.json`;
  const authOverride = authFromInput(input);
  const response = await client.request({ method: 'GET', path, authOverride });
  metadataCache.set(cacheKey, response);
  return response;
}
