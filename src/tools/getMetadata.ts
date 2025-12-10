import type { HttpClient } from '../httpClient.js';
import { LruCache } from '../cache.js';

export interface GetMetadataInput {
  domain: string;
  uid: string; // dataset identifier
  appToken?: string;
  username?: string;
  password?: string;
  bearerToken?: string;
}

const metadataCache = new LruCache<string, unknown>(100);

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

function authFromInput(input: { appToken?: string; username?: string; password?: string; bearerToken?: string }) {
  if (input.appToken) return { mode: 'appToken' as const, appToken: input.appToken };
  if (input.username && input.password) return { mode: 'basic' as const, username: input.username, password: input.password };
  if (input.bearerToken) return { mode: 'oauth2' as const, bearerToken: input.bearerToken };
  return undefined;
}
