import type { HttpClient } from '../httpClient.js';
import { buildSoqlQuery, type SoqlParams } from '../soqlBuilder.js';
import { clampLimit, clampOffset, DEFAULT_DEFAULT_LIMIT } from '../limits.js';
import { authFromInput, type AuthOverrideInput } from '../auth.js';

export interface QueryInput extends SoqlParams, AuthOverrideInput {
  domain: string;
  uid: string;
}

export async function queryDataset(client: HttpClient, input: QueryInput) {
  const safeLimit = clampLimit(input.limit, DEFAULT_DEFAULT_LIMIT);
  const safeOffset = clampOffset(input.offset);

  const hasStructured =
    !!(input.select?.length || input.where || input.order?.length || input.group?.length || input.having);

  const soql = hasStructured
    ? buildSoqlQuery({
        select: input.select,
        where: input.where,
        order: input.order,
        group: input.group,
        having: input.having,
        limit: safeLimit,
        offset: safeOffset,
      })
    : '';

  // Path differs between SODA2 and SODA3; this uses SODA2 resource path for simplicity.
  const path = `/resource/${input.uid}.json`;
  const authOverride = authFromInput(input);
  return client.request({
    method: 'GET',
    path,
    // Use $query when select/where/etc. present; otherwise rely on $limit/$offset params.
    query: hasStructured ? { $query: soql } : { $limit: safeLimit, $offset: safeOffset },
    authOverride,
  });
}
