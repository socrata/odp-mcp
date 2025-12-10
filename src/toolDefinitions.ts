// Unified tool definitions - single source of truth for tool metadata
// Used by both index.ts (MCP SDK) and mcpServer.ts (custom runtimes)

import { z } from 'zod';
import { DEFAULT_MAX_LIMIT, DEFAULT_DEFAULT_LIMIT, DEFAULT_PREVIEW_LIMIT, DEFAULT_MAX_OFFSET } from './limits.js';

// Common auth parameters shared across all tools
const authParams = {
  appToken: z.string().optional().describe('Override app token for this call'),
  username: z.string().optional().describe('Basic auth username (with password)'),
  password: z.string().optional().describe('Basic auth password'),
  bearerToken: z.string().optional().describe('Bearer token override'),
};

// Aggregate functions supported in select fields
const aggregateFunctions = ['sum', 'count', 'avg', 'min', 'max', 'stddev_samp', 'stddev_pop'] as const;
const transformFunctions = ['upper', 'lower', 'date_trunc_y', 'date_trunc_ym', 'date_trunc_ymd', 'length', 'abs'] as const;

// Structured select field schema (for aggregate queries)
const selectFieldSchema = z.object({
  column: z.string().describe('Column name'),
  function: z.enum([...aggregateFunctions, ...transformFunctions]).optional().describe('Aggregate or transform function'),
  alias: z.string().optional().describe('Result column alias'),
  args: z.array(z.union([z.string(), z.number()])).optional().describe('Additional function arguments'),
});

// Where condition operators
const whereOperators = [
  '=', '!=', '<', '>', '<=', '>=',
  'like', 'not like',
  'in', 'not in',
  'between', 'not between',
  'is null', 'is not null',
  'starts_with', 'contains',
] as const;

// Structured where condition schema (value is optional for IS NULL/IS NOT NULL and IN operators)
const whereConditionSchema = z.object({
  field: z.string().describe('Column to filter on'),
  operator: z.enum(whereOperators).optional().describe('Comparison operator (default: =)'),
  value: z.unknown().optional().describe('Value to compare against (optional for IS NULL, IN operators)'),
  valueIsNumeric: z.boolean().optional().describe('Treat value as numeric (no quotes)'),
  columnFunction: z.enum([...transformFunctions]).optional().describe('Function to apply to column'),
  valueFunction: z.enum([...transformFunctions]).optional().describe('Function to apply to value'),
  value2: z.unknown().optional().describe('Second value for BETWEEN operator'),
  values: z.array(z.unknown()).optional().describe('Multiple values for IN operator'),
  booleanType: z.enum(['AND', 'OR']).optional().describe('Boolean operator for combining conditions'),
});

// Tool definitions with Zod schemas and descriptions
export const toolDefinitions = {
  list_datasets: {
    description: 'Search datasets on a configured Socrata domain',
    schema: z.object({
      domain: z.string().describe('Example: data.cityofnewyork.us'),
      query: z.string().optional().describe('Search text, e.g. "311"'),
      limit: z.number().int().min(1).max(DEFAULT_MAX_LIMIT).optional().describe('Max rows to return (default 20)'),
      ...authParams,
    }),
  },
  get_metadata: {
    description: 'Fetch dataset metadata (columns, types, updated at)',
    schema: z.object({
      domain: z.string().describe('Example: data.cityofnewyork.us'),
      uid: z.string().describe('Dataset UID, e.g. nc67-uf89'),
      ...authParams,
    }),
  },
  preview_dataset: {
    description: 'Preview first N rows of a dataset',
    schema: z.object({
      domain: z.string().describe('Example: data.cityofnewyork.us'),
      uid: z.string().describe('Dataset UID, e.g. nc67-uf89'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(DEFAULT_MAX_LIMIT)
        .default(DEFAULT_PREVIEW_LIMIT)
        .optional()
        .describe('Rows to preview (default 50, max 5000)'),
      ...authParams,
    }),
  },
  query_dataset: {
    description: 'Run a structured SoQL query against a dataset. Supports aggregate functions (sum, count, avg, min, max), transform functions (upper, lower, date_trunc_*), and structured WHERE conditions with operators like BETWEEN, IN, IS NULL, starts_with, and contains.',
    schema: z.object({
      domain: z.string().describe('Example: data.cityofnewyork.us'),
      uid: z.string().describe('Dataset UID, e.g. nc67-uf89'),
      // Legacy: simple column names
      select: z.array(z.string()).optional().describe('Simple column names to select, e.g. ["unique_key","complaint_type"]'),
      // New: structured select with functions
      selectFields: z.array(selectFieldSchema).optional().describe('Structured select fields with aggregate/transform functions and aliases'),
      // Legacy: raw where string
      where: z.string().optional().describe("Raw SoQL filter, e.g. \"borough = 'MANHATTAN'\""),
      // New: structured where conditions
      whereConditions: z.union([whereConditionSchema, z.array(whereConditionSchema)]).optional()
        .describe('Structured WHERE conditions with operators, functions, BETWEEN, IN, IS NULL support'),
      order: z.array(z.string()).optional().describe('Sort clauses, e.g. ["created_date DESC"]'),
      group: z.array(z.string()).optional().describe('Group by columns'),
      having: z.string().optional().describe('Having clause for aggregate filters'),
      // New: full-text search
      search: z.string().optional().describe('Full-text search term ($q parameter)'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(DEFAULT_MAX_LIMIT)
        .default(DEFAULT_DEFAULT_LIMIT)
        .optional()
        .describe('Rows to return (default 500, max 5000)'),
      offset: z
        .number()
        .int()
        .min(0)
        .max(DEFAULT_MAX_OFFSET)
        .default(0)
        .optional()
        .describe('Offset for paging (max 50k)'),
      ...authParams,
    }),
  },
} as const;

export type ToolName = keyof typeof toolDefinitions;
