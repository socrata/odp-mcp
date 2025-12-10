// Enhanced SoQL Builder - inspired by socrata_app gem's SOQL::Builder
// Provides structured query building with validation and security

export interface SoqlParams {
  select?: (SelectField | string)[];
  where?: WhereCondition | WhereCondition[] | string;
  order?: string[];
  group?: string[];
  having?: string;
  limit?: number;
  offset?: number;
  search?: string; // Full-text search ($q parameter)
}

// Select field can be a simple column name or an aggregate/function
export interface SelectField {
  column: string;
  function?: AggregateFunction | TransformFunction;
  alias?: string;
  args?: (string | number)[]; // Additional function arguments
}

// Supported aggregate functions (from socrata_app AGGREGATION_FUNCTIONS)
export type AggregateFunction = 'sum' | 'count' | 'avg' | 'min' | 'max' | 'stddev_samp' | 'stddev_pop';

// Supported transform functions
export type TransformFunction =
  | 'upper'
  | 'lower'
  | 'date_trunc_y'
  | 'date_trunc_ym'
  | 'date_trunc_ymd'
  | 'length'
  | 'abs';

// Structured WHERE condition (like socrata_app's Condition class)
export interface WhereCondition {
  field: string;
  operator?: WhereOperator;
  value?: unknown; // Optional for IS NULL/IS NOT NULL and IN operators
  valueIsNumeric?: boolean;
  columnFunction?: TransformFunction;
  valueFunction?: TransformFunction;
  // For BETWEEN operator
  value2?: unknown;
  // For IN operator with multiple values
  values?: unknown[];
  // Boolean type for combining conditions
  booleanType?: 'AND' | 'OR';
}

export type WhereOperator =
  | '='
  | '!='
  | '<'
  | '>'
  | '<='
  | '>='
  | 'like'
  | 'not like'
  | 'in'
  | 'not in'
  | 'between'
  | 'not between'
  | 'is null'
  | 'is not null'
  | 'starts_with'
  | 'contains';

// Field validation regex (from socrata_app's Validator)
const FIELD_REGEX = /^[@a-zA-Z_][a-zA-Z0-9_:@-]*$/;

// Valid SoQL identifier: starts with letter/underscore, followed by letters/digits/underscores
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Valid order clause: identifier optionally followed by ASC/DESC (case-insensitive)
const ORDER_CLAUSE = /^[A-Za-z_][A-Za-z0-9_]*(?:\s+(?:ASC|DESC|asc|desc))?$/;

// Dangerous patterns that could indicate injection attempts (checked outside of quoted literals)
const DANGEROUS_PATTERNS = [
  /;/, // Statement terminator
  /--/, // SQL comment
  /\/\*/, // Block comment start
  /\*\//, // Block comment end
  /\bunion\b/i, // UNION attacks
  /\binto\b/i, // INTO (data exfiltration)
  /\bdrop\b/i, // DROP statements
  /\bdelete\b/i, // DELETE statements
  /\binsert\b/i, // INSERT statements
  /\bupdate\b/i, // UPDATE statements
  /\bexec\b/i, // EXEC/EXECUTE
  /\bexecute\b/i,
  /\bxp_/i, // SQL Server extended procedures
  /\bsp_/i, // SQL Server stored procedures
  /\|\|/, // String concatenation (potential injection)
  /\bchar\s*\(/i, // CHAR() function (obfuscation)
  /\bconcat\s*\(/i, // CONCAT() function (obfuscation)
  /0x[0-9a-f]+/i, // Hex-encoded strings
];

/**
 * Validates a field name against the allowed pattern
 * @throws Error if field name is invalid
 */
export function validateField(field: string, type = 'field'): void {
  if (!field || typeof field !== 'string') {
    throw new Error(`Invalid ${type}: must be a non-empty string`);
  }
  if (field === '*') return; // Allow wildcard
  if (!FIELD_REGEX.test(field)) {
    throw new Error(`Invalid ${type}: "${field}" must match pattern ${FIELD_REGEX}`);
  }
}

/**
 * Sanitize a string value by escaping single quotes (like socrata_app's sanitize method)
 */
export function sanitizeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  return String(value).replace(/'/g, "''");
}

/**
 * Remove single- and double-quoted string literals to avoid false positives
 */
function stripQuotedLiterals(clause: string): string {
  return clause
    .replace(/'([^'\\]|\\.)*'/g, '') // single-quoted
    .replace(/"([^"\\]|\\.)*"/g, ''); // double-quoted
}

/**
 * Ensures a clause doesn't contain dangerous patterns
 */
function ensureSafeClause(clause: string | undefined, label = 'clause'): void {
  if (!clause) return;

  const sanitized = stripQuotedLiterals(clause);

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(sanitized)) {
      throw new Error(`Unsafe ${label}: potentially dangerous pattern detected`);
    }
  }
}

/**
 * Validates identifiers in a list
 */
function ensureSafeIdentifiers(list: string[] | undefined): void {
  if (!list) return;
  for (const item of list) {
    if (!IDENT.test(item)) {
      throw new Error(`Unsafe identifier: ${item}`);
    }
  }
}

/**
 * Validates order clauses
 */
function ensureSafeOrderClauses(list: string[] | undefined): void {
  if (!list) return;
  for (const item of list) {
    if (!ORDER_CLAUSE.test(item.trim())) {
      throw new Error(`Unsafe order clause: ${item}`);
    }
  }
}

/**
 * Build a SELECT field expression with optional function and alias
 */
function buildSelectField(field: SelectField | string): string {
  // Handle simple string fields
  if (typeof field === 'string') {
    validateField(field, 'select field');
    return field;
  }

  validateField(field.column, 'select column');

  let expr = field.column;

  // Apply function if specified
  if (field.function) {
    const args = buildFunctionArgs(field.args);
    const argsSuffix = args ? `, ${args}` : '';
    expr = `${field.function}(${expr}${argsSuffix})`;
  }

  // Apply alias if specified
  if (field.alias) {
    validateField(field.alias, 'alias');
    expr = `${expr} AS ${field.alias}`;
  }

  return expr;
}

/**
 * Ensure a value is numeric (number type) and return it
 */
function requireNumeric(value: unknown, label: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Expected numeric ${label}`);
  }
  return value;
}

/**
 * Safely format function arguments by quoting strings and leaving numbers as-is
 */
function buildFunctionArgs(args: (string | number)[] | undefined): string {
  if (!args?.length) return '';

  return args
    .map((arg) => {
      if (typeof arg === 'number') return String(arg);
      return `'${sanitizeValue(arg)}'`;
    })
    .join(', ');
}

/**
 * Build a single WHERE condition expression
 */
function buildConditionExpression(condition: WhereCondition): string {
  validateField(condition.field, 'where field');

  let column = condition.field;
  if (condition.columnFunction) {
    column = `${condition.columnFunction}(${column})`;
  }

  const operator = condition.operator || '=';

  // Handle IS NULL / IS NOT NULL
  if (operator === 'is null') {
    return `${column} IS NULL`;
  }
  if (operator === 'is not null') {
    return `${column} IS NOT NULL`;
  }

  // Handle BETWEEN
  if (operator === 'between' || operator === 'not between') {
    if (condition.value === undefined || condition.value2 === undefined) {
      throw new Error('BETWEEN operator requires both value and value2');
    }
    const val1 = condition.valueIsNumeric
      ? requireNumeric(condition.value, 'value')
      : `'${sanitizeValue(condition.value)}'`;
    const val2 = condition.valueIsNumeric
      ? requireNumeric(condition.value2, 'value2')
      : `'${sanitizeValue(condition.value2)}'`;
    return `${column} ${operator.toUpperCase()} ${val1} AND ${val2}`;
  }

  // Handle IN / NOT IN
  if ((operator === 'in' || operator === 'not in') && condition.values) {
    if (!condition.values.length) {
      throw new Error('IN operator requires a non-empty values array');
    }
    const vals = condition.values
      .map((v) =>
        condition.valueIsNumeric ? requireNumeric(v, 'values') : `'${sanitizeValue(v)}'`,
      )
      .join(', ');
    return `${column} ${operator.toUpperCase()} (${vals})`;
  }

  // Handle function operators (starts_with, contains)
  if (operator === 'starts_with' || operator === 'contains') {
    let valueExpr = `'${sanitizeValue(condition.value)}'`;
    if (condition.valueFunction) {
      valueExpr = `${condition.valueFunction}(${valueExpr})`;
    }
    return `${operator}(${column}, ${valueExpr})`;
  }

  // Standard operators
  let valueExpr: string;
  if (condition.value === null || condition.value === undefined) {
    return operator === '!=' ? `${column} IS NOT NULL` : `${column} IS NULL`;
  } else if (condition.valueIsNumeric) {
    valueExpr = String(requireNumeric(condition.value, 'value'));
  } else {
    valueExpr = `'${sanitizeValue(condition.value)}'`;
    if (condition.valueFunction) {
      valueExpr = `${condition.valueFunction}(${valueExpr})`;
    }
  }

  return `${column} ${operator} ${valueExpr}`;
}

/**
 * Build WHERE clause from conditions
 */
function buildWhereClause(
  where: WhereCondition | WhereCondition[] | string | undefined,
): string | undefined {
  if (!where) return undefined;

  // Handle raw string (legacy support)
  if (typeof where === 'string') {
    ensureSafeClause(where, 'where');
    return where;
  }

  // Handle array of conditions
  if (Array.isArray(where)) {
    if (where.length === 0) return undefined;

    const expressions = where.map((cond) => buildConditionExpression(cond));

    // Combine with boolean type defined on the previous condition (default AND)
    return expressions.reduce((acc, expr, index) => {
      if (index === 0) return `(${expr})`;
      const joiner = where[index - 1].booleanType || 'AND';
      return `${acc} ${joiner} (${expr})`;
    }, '');
  }

  // Handle single condition
  return buildConditionExpression(where);
}

/**
 * Build the complete SoQL query string
 */
export function buildSoqlQuery(params: SoqlParams): string {
  const parts: string[] = [];

  // Build SELECT clause
  if (params.select?.length) {
    const selectFields = params.select.map((f) => buildSelectField(f));
    parts.push(`SELECT ${selectFields.join(', ')}`);
  }

  // Build WHERE clause
  const whereClause = buildWhereClause(params.where);
  if (whereClause) {
    parts.push(`WHERE ${whereClause}`);
  }

  // Build GROUP BY clause
  if (params.group?.length) {
    ensureSafeIdentifiers(params.group);
    parts.push(`GROUP BY ${params.group.join(', ')}`);
  }

  // Build HAVING clause
  if (params.having) {
    ensureSafeClause(params.having, 'having');
    parts.push(`HAVING ${params.having}`);
  }

  // Build ORDER BY clause
  if (params.order?.length) {
    ensureSafeOrderClauses(params.order);
    parts.push(`ORDER BY ${params.order.join(', ')}`);
  }

  // Build SEARCH clause ($q full-text search)
  if (params.search) {
    // Escape the search term
    const escaped = sanitizeValue(params.search);
    parts.push(`SEARCH '${escaped}'`);
  }

  // Build LIMIT clause
  if (typeof params.limit === 'number') {
    parts.push(`LIMIT ${params.limit}`);
  }

  // Build OFFSET clause
  if (typeof params.offset === 'number') {
    parts.push(`OFFSET ${params.offset}`);
  }

  return parts.join(' ');
}

/**
 * Build SoQL query parameters for URL encoding
 * Returns an object with $select, $where, etc. keys
 */
export function buildSoqlParams(params: SoqlParams): Record<string, string> {
  const result: Record<string, string> = {};

  // Build $select
  if (params.select?.length) {
    result.$select = params.select.map((f) => buildSelectField(f)).join(', ');
  }

  // Build $where
  const whereClause = buildWhereClause(params.where);
  if (whereClause) {
    result.$where = whereClause;
  }

  // Build $group
  if (params.group?.length) {
    ensureSafeIdentifiers(params.group);
    result.$group = params.group.join(', ');
  }

  // Build $having
  if (params.having) {
    ensureSafeClause(params.having, 'having');
    result.$having = params.having;
  }

  // Build $order
  if (params.order?.length) {
    ensureSafeOrderClauses(params.order);
    result.$order = params.order.join(', ');
  }

  // Build $q (full-text search)
  if (params.search) {
    result.$q = params.search;
  }

  // Build $limit
  if (typeof params.limit === 'number') {
    result.$limit = String(params.limit);
  }

  // Build $offset
  if (typeof params.offset === 'number') {
    result.$offset = String(params.offset);
  }

  return result;
}

// Legacy export for backwards compatibility
export { buildSoqlQuery as buildSoqlQueryString };
