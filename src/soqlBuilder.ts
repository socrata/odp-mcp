export interface SoqlParams {
  select?: string[];
  where?: string;
  order?: string[];
  group?: string[];
  having?: string;
  limit?: number;
  offset?: number;
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function ensureSafeIdentifiers(list?: string[]) {
  if (!list) return;
  for (const item of list) {
    if (!IDENT.test(item)) {
      throw new Error(`Unsafe identifier: ${item}`);
    }
  }
}

function ensureSafeClause(clause?: string, label = 'clause') {
  if (!clause) return;
  const lowered = clause.toLowerCase();
  if (lowered.includes(';') || lowered.includes('--') || lowered.includes('/*') || lowered.includes('*/')) {
    throw new Error(`Unsafe ${label}`);
  }
}

export function buildSoqlQuery(params: SoqlParams): string {
  // Build a raw SoQL query string (no $ prefixes); caller is responsible for URL encoding.
  ensureSafeIdentifiers(params.select);
  ensureSafeIdentifiers(params.order);
  ensureSafeIdentifiers(params.group);
  ensureSafeClause(params.where, 'where');
  ensureSafeClause(params.having, 'having');

  const parts: string[] = [];
  if (params.select?.length) parts.push(`select ${params.select.join(', ')}`);
  if (params.where) parts.push(`where ${params.where}`);
  if (params.group?.length) parts.push(`group by ${params.group.join(', ')}`);
  if (params.having) parts.push(`having ${params.having}`);
  if (params.order?.length) parts.push(`order by ${params.order.join(', ')}`);
  if (typeof params.limit === 'number') parts.push(`limit ${params.limit}`);
  if (typeof params.offset === 'number') parts.push(`offset ${params.offset}`);
  return parts.join(' ');
}
