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
    description: 'Run a structured SoQL query against a dataset',
    schema: z.object({
      domain: z.string().describe('Example: data.cityofnewyork.us'),
      uid: z.string().describe('Dataset UID, e.g. nc67-uf89'),
      select: z.array(z.string()).optional().describe('Columns to select, e.g. ["unique_key","complaint_type"]'),
      where: z.string().optional().describe("SoQL filter, e.g. \"borough = 'MANHATTAN'\""),
      order: z.array(z.string()).optional().describe('Sort clauses, e.g. ["created_date DESC"]'),
      group: z.array(z.string()).optional().describe('Group by columns'),
      having: z.string().optional().describe('Having clause'),
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
