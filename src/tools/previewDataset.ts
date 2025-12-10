import type { HttpClient } from '../httpClient.js';
import { clampLimit, DEFAULT_PREVIEW_LIMIT } from '../limits.js';
import { authFromInput, type AuthOverrideInput } from '../auth.js';
import { logger } from '../logger.js';

export interface PreviewInput extends AuthOverrideInput {
  domain: string;
  uid: string;
  limit?: number;
}

export async function previewDataset(client: HttpClient, input: PreviewInput) {
  const limit = clampLimit(input.limit, DEFAULT_PREVIEW_LIMIT);
  const path = `/resource/${input.uid}.json`;
  const authOverride = authFromInput(input);
  logger.soqlQuery(input.domain, input.uid, `LIMIT ${limit}`);
  return client.request({
    method: 'GET',
    path,
    query: { $limit: limit },
    authOverride,
  });
}
