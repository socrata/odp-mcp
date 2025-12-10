import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadConfig } from './config.js';
import { createClientRegistry, getClient } from './clients.js';
import { listDatasets } from './tools/listDatasets.js';
import { getMetadata } from './tools/getMetadata.js';
import { previewDataset } from './tools/previewDataset.js';
import { queryDataset } from './tools/queryDataset.js';
import { toolDefinitions } from './toolDefinitions.js';
import { startHttpServer } from './httpServer.js';

async function bootstrap() {
  const config = loadConfig();
  if (!config.domains.length) {
    console.warn('No domains preconfigured; set SODA_DOMAINS to pre-warm, or pass domain per call.');
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

  // Helper to extract payload from tool response
  const extractPayload = (res: unknown): unknown => {
    if (res && typeof res === 'object' && 'data' in res) {
      return (res as { data: unknown }).data;
    }
    return res;
  };

  // Register tools using unified definitions (provide full Zod schema to preserve root type)
  server.registerTool(
    'list_datasets',
    { description: toolDefinitions.list_datasets.description, inputSchema: toolDefinitions.list_datasets.schema },
    async (input: z.infer<typeof toolDefinitions.list_datasets.schema>, _extra: unknown) => {
      const res = await listDatasets(getClient(clients, input.domain), input);
      return { content: [{ type: 'text', text: JSON.stringify(extractPayload(res)) }] };
    },
  );

  server.registerTool(
    'get_metadata',
    { description: toolDefinitions.get_metadata.description, inputSchema: toolDefinitions.get_metadata.schema },
    async (input: z.infer<typeof toolDefinitions.get_metadata.schema>, _extra: unknown) => {
      const res = await getMetadata(getClient(clients, input.domain), input, { cacheTtlMs: config.cacheTtlMs });
      return { content: [{ type: 'text', text: JSON.stringify(extractPayload(res)) }] };
    },
  );

  server.registerTool(
    'preview_dataset',
    { description: toolDefinitions.preview_dataset.description, inputSchema: toolDefinitions.preview_dataset.schema },
    async (input: z.infer<typeof toolDefinitions.preview_dataset.schema>, _extra: unknown) => {
      const res = await previewDataset(getClient(clients, input.domain), input);
      return { content: [{ type: 'text', text: JSON.stringify(extractPayload(res)) }] };
    },
  );

  server.registerTool(
    'query_dataset',
    { description: toolDefinitions.query_dataset.description, inputSchema: toolDefinitions.query_dataset.schema },
    async (input: z.infer<typeof toolDefinitions.query_dataset.schema>, _extra: unknown) => {
      const res = await queryDataset(getClient(clients, input.domain), input);
      return { content: [{ type: 'text', text: JSON.stringify(extractPayload(res)) }] };
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
