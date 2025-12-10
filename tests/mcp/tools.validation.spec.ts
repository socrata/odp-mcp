import { describe, it, expect } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

describe('MCP tool validation (zod schemas)', () => {
  const server = new McpServer({ name: 'test', version: '0.0.0' });

  server.tool(
    'sample_tool',
    { domain: z.string(), limit: z.number().int().min(1).max(10) },
    async ({ domain, limit }) => ({ content: [{ type: 'text', text: `${domain}:${limit}` }] }),
  );

  it('rejects invalid input before handler runs', async () => {
    // Call handler but run schema parsing manually to mimic server behavior
    const tool = (server as any)._registeredTools.sample_tool;
    const parse = tool.inputSchema.parseAsync.bind(tool.inputSchema);
    await expect(parse({ domain: 'example.org', limit: 0 })).rejects.toThrow();
  });
});
