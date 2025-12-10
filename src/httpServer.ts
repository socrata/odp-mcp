import * as http from 'node:http';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger, generateRequestId } from './logger.js';
import { toolDefinitions, type ToolName } from './toolDefinitions.js';

interface RegisteredTool {
  inputSchema?: { parseAsync: (value: unknown) => Promise<unknown> };
  handler: (args: unknown, extra?: unknown) => Promise<unknown>;
}

// Type for accessing MCP SDK internal registry (private API - may change between versions)
interface McpServerInternal {
  _registeredTools?: Record<string, RegisteredTool>;
}

// Type for Zod schema internal structure
interface ZodSchemaLike {
  _def?: unknown;
}

// Extract Zod schema definition safely
function extractZodDef(schema: unknown): unknown {
  if (schema && typeof schema === 'object' && '_def' in schema) {
    return (schema as ZodSchemaLike)._def;
  }
  return undefined;
}

export async function startHttpServer(server: McpServer, port: number) {
  // Access private registry used by McpServer; SDK does not expose a public getter yet.
  // WARNING: This relies on internal MCP SDK implementation details.
  // Pin @modelcontextprotocol/sdk version and test after upgrades.
  const registry = (server as unknown as McpServerInternal)._registeredTools;
  if (!registry) throw new Error('No tool registry found on MCP server');

  const sendJson = (res: http.ServerResponse, status: number, body: unknown) => {
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
        const manifest = Object.entries(registry).map(([name, t]) => ({
          name,
          description: toolDefinitions[name as ToolName]?.description,
          schema: extractZodDef(t.inputSchema),
          example: toolExamples[name],
        }));
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, tools: manifest }));
        return;
      }

      // Manifest alias for compatibility
      if (req.method === 'GET' && req.url === '/manifest') {
        const manifest = Object.entries(registry).map(([name, t]) => ({
          name,
          description: toolDefinitions[name as ToolName]?.description,
          schema: extractZodDef(t.inputSchema),
          example: toolExamples[name],
        }));
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, tools: manifest }));
        return;
      }

      // Manifest alias for clients that hit /mcp with GET
      if (req.method === 'GET' && req.url === '/mcp') {
        const manifest = Object.entries(registry).map(([name, t]) => ({
          name,
          description: toolDefinitions[name as ToolName]?.description,
          schema: extractZodDef(t.inputSchema),
          example: toolExamples[name],
        }));
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, tools: manifest }));
        return;
      }

      // MCP JSON-RPC over HTTP (minimal, non-streaming)
      if (req.url === '/mcp' && req.method === 'POST') {
        const body = await readBody(req);

        interface JsonRpcRequest {
          id?: string | number | null;
          method?: string;
          params?: { name?: string; arguments?: Record<string, unknown> };
        }

        const handleRpc = async (rpc: JsonRpcRequest) => {
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
              description: (name in toolDefinitions)
                ? toolDefinitions[name as ToolName].description
                : `Tool: ${name}`,
              inputSchema: extractZodDef(t.inputSchema),
            }));
            return { jsonrpc: '2.0', id, result: { tools } };
          }

          if (method === 'tools/call') {
            const name = params?.name;
            const args = params?.arguments ?? {};
            const requestId = generateRequestId();
            if (!name) {
              return { jsonrpc: '2.0', id, error: { code: -32004, message: 'Tool name required' } };
            }
            const tool = registry[name];
            if (!tool) {
              logger.warn(`Unknown tool requested: ${name}`, { tool: name, requestId });
              return { jsonrpc: '2.0', id, error: { code: -32004, message: `Unknown tool ${name}` } };
            }
            const startTime = Date.now();
            logger.toolRequest(name, args as Record<string, unknown>, requestId);
            try {
              const parsedInput = tool.inputSchema ? await tool.inputSchema.parseAsync(args) : args;
              const result = await tool.handler(parsedInput, { requestId });
              const durationMs = Date.now() - startTime;
              // Extract row count if result has content array
              let rowCount: number | undefined;
              if (result && typeof result === 'object' && 'content' in result) {
                const content = (result as { content: unknown[] }).content;
                if (Array.isArray(content) && content[0] && typeof content[0] === 'object' && 'text' in content[0]) {
                  try {
                    const parsed = JSON.parse((content[0] as { text: string }).text);
                    if (Array.isArray(parsed)) rowCount = parsed.length;
                  } catch { /* ignore parse errors */ }
                }
              }
              logger.toolResponse(name, durationMs, true, rowCount, requestId);
              return { jsonrpc: '2.0', id, result };
            } catch (err: unknown) {
              const durationMs = Date.now() - startTime;
              const message = err instanceof Error ? err.message : 'Tool error';
              logger.toolResponse(name, durationMs, false, undefined, requestId, message);
              return { jsonrpc: '2.0', id, error: { code: -32000, message } };
            }
          }

          return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } };
        };

        if (Array.isArray(body)) {
          const responses = [];
          for (const rpc of body) responses.push(await handleRpc(rpc as JsonRpcRequest));
          sendJson(res, 200, responses);
        } else {
          const response = await handleRpc(body as JsonRpcRequest);
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
      const requestId = generateRequestId();
      if (!tool) {
        logger.warn(`Unknown tool requested: ${name}`, { tool: name, requestId });
        sendJson(res, 404, { error: `Unknown tool ${name}` });
        return;
      }

      const body = await readBody(req);
      const startTime = Date.now();
      logger.toolRequest(name, body as Record<string, unknown>, requestId);
      const parsedInput = tool.inputSchema ? await tool.inputSchema.parseAsync(body) : body;
      const result = await tool.handler(parsedInput, { requestId });
      const durationMs = Date.now() - startTime;
      // Extract row count if result has data array
      let rowCount: number | undefined;
      if (result && typeof result === 'object' && 'data' in result) {
        const data = (result as { data: unknown }).data;
        if (Array.isArray(data)) rowCount = data.length;
      }
      logger.toolResponse(name, durationMs, true, rowCount, requestId);
      sendJson(res, 200, { ok: true, result });
    } catch (err: unknown) {
      const status = (err && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number')
        ? (err as { status: number }).status
        : 500;
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, status, { ok: false, error: message });
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
