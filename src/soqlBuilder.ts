export interface SoqlParams {
  select?: string[];
  where?: string;
  order?: string[];
  group?: string[];
  having?: string;
  limit?: number;
  offset?: number;
}

// Valid SoQL identifier: starts with letter/underscore, followed by letters/digits/underscores
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Valid order clause: identifier optionally followed by ASC/DESC (case-insensitive)
const ORDER_CLAUSE = /^[A-Za-z_][A-Za-z0-9_]*(?:\s+(?:ASC|DESC|asc|desc))?$/;

function ensureSafeIdentifiers(list?: string[]) {
  if (!list) return;
  for (const item of list) {
    if (!IDENT.test(item)) {
      throw new Error(`Unsafe identifier: ${item}`);
    }
  }
}

function ensureSafeOrderClauses(list?: string[]) {
  if (!list) return;
  for (const item of list) {
    if (!ORDER_CLAUSE.test(item.trim())) {
      throw new Error(`Unsafe order clause: ${item}`);
    }
  }
}

// Dangerous patterns that could indicate injection attempts
const DANGEROUS_PATTERNS = [
  /;/,                           // Statement terminator
  /--/,                          // SQL comment
  /\/\*/,                        // Block comment start
  /\*\//,                        // Block comment end
  /\bunion\b/i,                  // UNION attacks
  /\binto\b/i,                   // INTO (data exfiltration)
  /\bdrop\b/i,                   // DROP statements
  /\bdelete\b/i,                 // DELETE statements
  /\binsert\b/i,                 // INSERT statements
  /\bupdate\b/i,                 // UPDATE statements
  /\bexec\b/i,                   // EXEC/EXECUTE
  /\bexecute\b/i,
  /\bxp_/i,                      // SQL Server extended procedures
  /\bsp_/i,                      // SQL Server stored procedures
  /\|\|/,                        // String concatenation (potential injection)
  /\bchar\s*\(/i,                // CHAR() function (obfuscation)
  /\bconcat\s*\(/i,              // CONCAT() function (obfuscation)
  /0x[0-9a-f]+/i,                // Hex-encoded strings
];

function ensureSafeClause(clause?: string, label = 'clause') {
  if (!clause) return;

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(clause)) {
      throw new Error(`Unsafe ${label}: potentially dangerous pattern detected`);
    }
  }
}

export function buildSoqlQuery(params: SoqlParams): string {
  // Build a raw SoQL query string (no $ prefixes); caller is responsible for URL encoding.
  ensureSafeIdentifiers(params.select);
  ensureSafeOrderClauses(params.order);
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
