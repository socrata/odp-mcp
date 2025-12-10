import type { HttpClient } from '../httpClient.js';
import { clampLimit, DEFAULT_PREVIEW_LIMIT } from '../limits.js';

export interface PreviewInput {
  domain: string;
  uid: string;
  limit?: number;
  appToken?: string;
  username?: string;
  password?: string;
  bearerToken?: string;
}

export async function previewDataset(client: HttpClient, input: PreviewInput) {
  const limit = clampLimit(input.limit, DEFAULT_PREVIEW_LIMIT);
  const path = `/resource/${input.uid}.json`;
  const authOverride = authFromInput(input);
  return client.request({
    method: 'GET',
    path,
    query: { $limit: limit },
    authOverride,
  });
}

function authFromInput(input: { appToken?: string; username?: string; password?: string; bearerToken?: string }) {
  if (input.appToken) return { mode: 'appToken' as const, appToken: input.appToken };
  if (input.username && input.password) return { mode: 'basic' as const, username: input.username, password: input.password };
  if (input.bearerToken) return { mode: 'oauth2' as const, bearerToken: input.bearerToken };
  return undefined;
}
