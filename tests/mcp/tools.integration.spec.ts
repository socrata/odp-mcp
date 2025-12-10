import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// Minimal stub transport for registration checks.
import { z } from 'zod';
import { loadConfig } from '../../src/config.js';
import { createClientRegistry, getClient } from '../../src/clients.js';
import { listDatasets } from '../../src/tools/listDatasets.js';
import { getMetadata } from '../../src/tools/getMetadata.js';
import { previewDataset } from '../../src/tools/previewDataset.js';
import { queryDataset } from '../../src/tools/queryDataset.js';
import {
  DEFAULT_MAX_LIMIT,
  DEFAULT_DEFAULT_LIMIT,
  DEFAULT_PREVIEW_LIMIT,
  DEFAULT_MAX_OFFSET,
} from '../../src/limits.js';

describe('MCP tool registration (memory transport)', () => {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  const transport: any = {
    async start() {},
    async stop() {},
    async send() {},
    onclose: null,
    onmessage: null,
    onerror: null,
  };
  const config = loadConfig();
  const clients = createClientRegistry({
    ...config,
    domains: [
      {
        domain: 'example.org',
        auth: { mode: 'none' },
      },
    ],
  });

  server.tool(
    'list_datasets',
    {
      domain: z.string(),
      query: z.string().optional(),
      limit: z.number().int().min(1).max(DEFAULT_MAX_LIMIT).optional(),
    },
    async ({ domain, query, limit }) => {
      const res = await listDatasets(getClient(clients, domain), { domain, query, limit });
      const payload = (res as any).data ?? res;
      return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
    },
  );

  server.tool(
    'get_metadata',
    {
      domain: z.string(),
      uid: z.string(),
    },
    async ({ domain, uid }) => {
      const res = await getMetadata(getClient(clients, domain), { domain, uid });
      const payload = (res as any).data ?? res;
      return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
    },
  );

  server.tool(
    'preview_dataset',
    {
      domain: z.string(),
      uid: z.string(),
      limit: z.number().int().min(1).max(DEFAULT_MAX_LIMIT).default(DEFAULT_PREVIEW_LIMIT).optional(),
    },
    async ({ domain, uid, limit }) => {
      const res = await previewDataset(getClient(clients, domain), { domain, uid, limit });
      const payload = (res as any).data ?? res;
      return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
    },
  );

  server.tool(
    'query_dataset',
    {
      domain: z.string(),
      uid: z.string(),
      select: z.array(z.string()).optional(),
      where: z.string().optional(),
      order: z.array(z.string()).optional(),
      group: z.array(z.string()).optional(),
      having: z.string().optional(),
      limit: z.number().int().min(1).max(DEFAULT_MAX_LIMIT).default(DEFAULT_DEFAULT_LIMIT).optional(),
      offset: z.number().int().min(0).max(DEFAULT_MAX_OFFSET).default(0).optional(),
    },
    async ({ domain, uid, select, where, order, group, having, limit, offset }) => {
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
      });
      const payload = (res as any).data ?? res;
      return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
    },
  );

  beforeAll(async () => {
    await server.connect(transport);
  });

  afterAll(async () => {
    await transport.stop?.();
  });

  it('registers tools with zod schemas', () => {
    // Inspect private _registeredTools bag.
    const registered = (server as any)._registeredTools ?? {};
    const names = Object.keys(registered);
    expect(names).toEqual(expect.arrayContaining(['list_datasets', 'get_metadata', 'preview_dataset', 'query_dataset']));
  });
});
