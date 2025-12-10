import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadConfig } from './config.js';
import { createClientRegistry, getClient } from './clients.js';
import { listDatasets } from './tools/listDatasets.js';
import { getMetadata } from './tools/getMetadata.js';
import { previewDataset } from './tools/previewDataset.js';
import { queryDataset } from './tools/queryDataset.js';
import { DEFAULT_MAX_LIMIT, DEFAULT_DEFAULT_LIMIT, DEFAULT_PREVIEW_LIMIT, DEFAULT_MAX_OFFSET } from './limits.js';
import { startHttpServer } from './httpServer.js';

async function bootstrap() {
  const config = loadConfig();
  if (!config.domains.length) {
    console.warn('No domains configured; set SODA_DOMAINS before starting the server.');
  }

  // Optional manifest integrity check
  const expectedHash = process.env.MANIFEST_SHA256;
  if (expectedHash) {
    const manifestString = JSON.stringify(
      ['list_datasets', 'get_metadata', 'preview_dataset', 'query_dataset'].sort(),
    );
    const hash = await sha256(manifestString);
    if (hash !== expectedHash) {
      throw new Error('Manifest hash mismatch; aborting startup');
    }
  }

  const clients = createClientRegistry(config);
  const server = new McpServer({
    name: 'socrata-soda-mcp',
    version: '0.1.0',
  });

  server.tool(
    'list_datasets',
    {
      domain: z.string().describe('Example: data.cityofnewyork.us'),
      query: z.string().optional().describe('Search text, e.g. "311"'),
      limit: z.number().int().min(1).max(DEFAULT_MAX_LIMIT).optional().describe('Max rows to return (default 20)'),
      appToken: z.string().optional().describe('Override app token for this call'),
      username: z.string().optional().describe('Basic auth username (with password)'),
      password: z.string().optional().describe('Basic auth password'),
      bearerToken: z.string().optional().describe('Bearer token override'),
    },
    async (
      {
        domain,
        query,
        limit,
        appToken,
        username,
        password,
        bearerToken,
      }: {
        domain: string;
        query?: string;
        limit?: number;
        appToken?: string;
        username?: string;
        password?: string;
        bearerToken?: string;
      },
      _extra: unknown,
    ) => {
      const res = await listDatasets(getClient(clients, domain), {
        domain,
        query,
        limit,
        appToken,
        username,
        password,
        bearerToken,
      });
      const payload = (res as any).data ?? res;
      return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
    },
  );

  server.tool(
    'get_metadata',
    {
      domain: z.string().describe('Example: data.cityofnewyork.us'),
      uid: z.string().describe('Dataset UID, e.g. nc67-uf89'),
      appToken: z.string().optional().describe('Override app token for this call'),
      username: z.string().optional().describe('Basic auth username (with password)'),
      password: z.string().optional().describe('Basic auth password'),
      bearerToken: z.string().optional().describe('Bearer token override'),
    },
    async (
      {
        domain,
        uid,
        appToken,
        username,
        password,
        bearerToken,
      }: {
        domain: string;
        uid: string;
        appToken?: string;
        username?: string;
        password?: string;
        bearerToken?: string;
      },
      _extra: unknown,
    ) => {
      const res = await getMetadata(getClient(clients, domain), { domain, uid, appToken, username, password, bearerToken });
      const payload = (res as any).data ?? res;
      return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
    },
  );

  server.tool(
    'preview_dataset',
    {
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
      appToken: z.string().optional().describe('Override app token for this call'),
      username: z.string().optional().describe('Basic auth username (with password)'),
      password: z.string().optional().describe('Basic auth password'),
      bearerToken: z.string().optional().describe('Bearer token override'),
    },
    async (
      {
        domain,
        uid,
        limit,
        appToken,
        username,
        password,
        bearerToken,
      }: {
        domain: string;
        uid: string;
        limit?: number;
        appToken?: string;
        username?: string;
        password?: string;
        bearerToken?: string;
      },
      _extra: unknown,
    ) => {
      const res = await previewDataset(getClient(clients, domain), {
        domain,
        uid,
        limit,
        appToken,
        username,
        password,
        bearerToken,
      });
      const payload = (res as any).data ?? res;
      return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
    },
  );

  server.tool(
    'query_dataset',
    {
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
      appToken: z.string().optional().describe('Override app token for this call'),
      username: z.string().optional().describe('Basic auth username (with password)'),
      password: z.string().optional().describe('Basic auth password'),
      bearerToken: z.string().optional().describe('Bearer token override'),
    },
    async (
      {
        domain,
        uid,
        select,
        where,
        order,
        group,
        having,
        limit,
        offset,
        appToken,
        username,
        password,
        bearerToken,
      }: {
        domain: string;
        uid: string;
        select?: string[];
        where?: string;
        order?: string[];
        group?: string[];
        having?: string;
        limit?: number;
        offset?: number;
        appToken?: string;
        username?: string;
        password?: string;
        bearerToken?: string;
      },
      _extra: unknown,
    ) => {
      const res = await queryDataset(getClient(clients, domain), {
        domain,
        uid,
        select,
        where,
        order,
        group,
        having,
        limit,
        offset,
        appToken,
        username,
        password,
        bearerToken,
      });
      const payload = (res as any).data ?? res;
      return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
    },
  );

  const port = process.env.PORT ? Number(process.env.PORT) : undefined;
  if (port) {
    await startHttpServer(server, port);
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

bootstrap().catch((err) => {
  console.error('Failed to start MCP server', err);
  process.exit(1);
});

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
