import * as http from 'node:http';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

interface RegisteredTool {
  inputSchema?: { parseAsync: (value: unknown) => Promise<any> };
  handler: (args: any, extra?: any) => Promise<any>;
}

export async function startHttpServer(server: McpServer, port: number) {
  // Access private registry used by McpServer; SDK does not expose a public getter yet.
  const registry = (server as any)._registeredTools as Record<string, RegisteredTool> | undefined;
  if (!registry) throw new Error('No tool registry found on MCP server');

  const sendJson = (res: http.ServerResponse, status: number, body: any) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  };

  const toolExamples: Record<string, unknown> = {
    list_datasets: {
      domain: 'data.cityofnewyork.us',
      query: '311',
      limit: 5,
    },
    get_metadata: {
      domain: 'data.cityofnewyork.us',
      uid: 'erm2-nwe9',
    },
    preview_dataset: {
      domain: 'data.cityofnewyork.us',
      uid: 'erm2-nwe9',
      limit: 10,
    },
    query_dataset: {
      domain: 'data.cityofnewyork.us',
      uid: 'erm2-nwe9',
      select: ['unique_key', 'complaint_type', 'borough'],
      where: "borough = 'MANHATTAN'",
      order: ['created_date DESC'],
      limit: 5,
    },
  };

  const app = http.createServer(async (req, res) => {
    try {
      // Enforce HTTPS when behind proxy (Heroku)
      const proto = req.headers['x-forwarded-proto'];
      if (proto && proto !== 'https') {
        const host = req.headers.host ?? '';
        res.statusCode = 301;
        res.setHeader('Location', `https://${host}${req.url}`);
        res.end();
        return;
      }

      // API key gate (if configured)
      const apiKeys = process.env.HTTP_API_KEYS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
      if (apiKeys.length) {
        const provided = req.headers['x-api-key'];
        if (!provided || !apiKeys.includes(String(provided))) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
          return;
        }
      }

      // Health check
      if (req.method === 'GET' && req.url === '/healthz') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, status: 'healthy' }));
        return;
      }

      // Readiness probe alias
      if (req.method === 'GET' && req.url === '/readyz') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, status: 'ready' }));
        return;
      }

      // Manifest of tools: GET /tools
      if (req.method === 'GET' && req.url === '/tools') {
        const manifest = Object.entries(registry).map(([name, t]) => {
          let schema: unknown = undefined;
          if ((t.inputSchema as any)?._def) {
            schema = (t.inputSchema as any)._def;
          }
          return { name, schema, example: toolExamples[name] };
        });
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, tools: manifest }));
        return;
      }

      // Manifest alias for compatibility
      if (req.method === 'GET' && req.url === '/manifest') {
        const manifest = Object.entries(registry).map(([name, t]) => ({
          name,
          schema: (t.inputSchema as any)?._def,
          example: toolExamples[name],
        }));
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, tools: manifest }));
        return;
      }

      // MCP JSON-RPC over HTTP (minimal, non-streaming)
      if (req.url === '/mcp' && req.method === 'POST') {
        const body = await readBody(req);

        const handleRpc = async (rpc: any) => {
          const { id, method, params } = rpc ?? {};
          if (!method) {
            return { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } };
          }

          if (method === 'initialize') {
            return {
              jsonrpc: '2.0',
              id,
              result: {
                protocolVersion: '2025-03-26',
                capabilities: { tools: {} },
                serverInfo: { name: 'socrata-soda-mcp', version: '0.1.0' },
              },
            };
          }

          if (method === 'tools/list') {
            const tools = Object.entries(registry).map(([name, t]) => ({
              name,
              description: undefined,
              inputSchema: (t.inputSchema as any)?._def,
            }));
            return { jsonrpc: '2.0', id, result: { tools } };
          }

          if (method === 'tools/call') {
            const name = params?.name;
            const args = params?.arguments ?? {};
            const tool = registry[name];
            if (!tool) {
              return { jsonrpc: '2.0', id, error: { code: -32004, message: `Unknown tool ${name}` } };
            }
            try {
              const parsedInput = tool.inputSchema ? await tool.inputSchema.parseAsync(args) : args;
              const result = await tool.handler(parsedInput);
              return { jsonrpc: '2.0', id, result };
            } catch (err: any) {
              return { jsonrpc: '2.0', id, error: { code: -32000, message: err?.message ?? 'Tool error' } };
            }
          }

          return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } };
        };

        if (Array.isArray(body)) {
          const responses = [];
          for (const rpc of body) responses.push(await handleRpc(rpc));
          sendJson(res, 200, responses);
        } else {
          const response = await handleRpc(body);
          sendJson(res, 200, response);
        }
        return;
      }

      // Friendly root page
      if (req.method === 'GET' && req.url === '/') {
        const toolNames = Object.keys(registry);
        const body = {
          name: 'Socrata SODA MCP Server',
          description: 'Read-only MCP tools for Socrata SODA datasets (search, metadata, preview, query).',
          endpoints: {
            mcp: '/mcp',
            invokeTool: '/tools/{tool_name}',
            manifest: '/tools',
            health: '/healthz',
            ready: '/readyz',
          },
          capabilities: {
            tools: toolNames,
            resources: [],
          },
        };
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(body));
        return;
      }

      // MCP descriptor alias
      if (req.method === 'GET' && req.url === '/mcp') {
        const toolNames = Object.keys(registry);
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            name: 'Socrata SODA MCP Server',
            description: 'MCP HTTP bridge; see /tools for manifest',
            endpoints: { invokeTool: '/tools/{tool_name}', manifest: '/tools', health: '/healthz', ready: '/readyz' },
            capabilities: { tools: toolNames, resources: [] },
          }),
        );
        return;
      }

      if (req.method !== 'POST' || !req.url?.startsWith('/tools/')) {
        sendJson(res, 404, { error: 'Not found' });
        return;
      }

      const name = decodeURIComponent(req.url.split('/')[2] ?? '');
      const tool = registry[name];
      if (!tool) {
        sendJson(res, 404, { error: `Unknown tool ${name}` });
        return;
      }

      const body = await readBody(req);
      const parsedInput = tool.inputSchema ? await tool.inputSchema.parseAsync(body) : body;
      const result = await tool.handler(parsedInput);
      sendJson(res, 200, { ok: true, result });
    } catch (err: any) {
      sendJson(res, err?.status && Number.isInteger(err.status) ? err.status : 500, {
        ok: false,
        error: err?.message ?? String(err),
      });
    }
  });

  await new Promise<void>((resolve) => app.listen(port, resolve));
  console.log(`HTTP MCP bridge listening on port ${port}`);
}

// Maximum request body size (512KB - reasonable for JSON API requests)
const MAX_BODY_SIZE = 512 * 1024;

class PayloadTooLargeError extends Error {
  status = 413;
  constructor() {
    super('Request body too large');
    this.name = 'PayloadTooLargeError';
  }
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer | string) => {
      data += chunk;
      if (data.length > MAX_BODY_SIZE) {
        req.destroy();
        reject(new PayloadTooLargeError());
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}
