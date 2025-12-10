import type { HttpClient } from '../httpClient.js';
import {
  buildSoqlQuery,
  buildSoqlParams,
  type SoqlParams,
  type SelectField,
  type WhereCondition,
} from '../soqlBuilder.js';
import { clampLimit, clampOffset, DEFAULT_DEFAULT_LIMIT } from '../limits.js';
import { authFromInput, type AuthOverrideInput } from '../auth.js';

// Extended query input supporting both legacy string-based and new structured formats
export interface QueryInput extends AuthOverrideInput {
  domain: string;
  uid: string;
  // Legacy: simple column names as strings
  select?: string[];
  // New: structured select with functions/aliases (takes precedence if provided)
  selectFields?: SelectField[];
  // Legacy: raw where string
  where?: string;
  // New: structured where conditions (takes precedence if provided)
  whereConditions?: WhereCondition | WhereCondition[];
  order?: string[];
  group?: string[];
  having?: string;
  limit?: number;
  offset?: number;
  // New: full-text search
  search?: string;
}

// Convert simple string selects to SelectField format
function normalizeSelect(input: QueryInput): (SelectField | string)[] | undefined {
  if (input.selectFields?.length) {
    return input.selectFields;
  }
  if (input.select?.length) {
    return input.select;
  }
  return undefined;
}

// Get where clause - prefer structured conditions over raw string
function normalizeWhere(input: QueryInput): WhereCondition | WhereCondition[] | string | undefined {
  if (input.whereConditions) {
    return input.whereConditions;
  }
  return input.where;
}

export async function queryDataset(client: HttpClient, input: QueryInput) {
  const safeLimit = clampLimit(input.limit, DEFAULT_DEFAULT_LIMIT);
  const safeOffset = clampOffset(input.offset);

  const normalizedSelect = normalizeSelect(input);
  const normalizedWhere = normalizeWhere(input);

  const hasStructured = !!(
    normalizedSelect?.length ||
    normalizedWhere ||
    input.order?.length ||
    input.group?.length ||
    input.having ||
    input.search
  );

  const soqlParams: SoqlParams = {
    select: normalizedSelect,
    where: normalizedWhere,
    order: input.order,
    group: input.group,
    having: input.having,
    search: input.search,
    limit: safeLimit,
    offset: safeOffset,
  };

  // Path differs between SODA2 and SODA3; this uses SODA2 resource path for simplicity.
  const path = `/resource/${input.uid}.json`;
  const authOverride = authFromInput(input);

  // Use $query for full SoQL, or individual params for simpler queries
  if (hasStructured) {
    const soql = buildSoqlQuery(soqlParams);
    return client.request({
      method: 'GET',
      path,
      query: { $query: soql },
      authOverride,
    });
  }

  // No structured query - just use limit/offset
  return client.request({
    method: 'GET',
    path,
    query: { $limit: safeLimit, $offset: safeOffset },
    authOverride,
  });
}
