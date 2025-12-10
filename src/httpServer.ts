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

      // Manifest of tools: GET /tools
      if (req.method === 'GET' && req.url === '/tools') {
        const manifest = Object.entries(registry).map(([name, t]) => {
          let schema: unknown = undefined;
          if ((t.inputSchema as any)?._def) {
            schema = (t.inputSchema as any)._def;
          }
          return { name, schema };
        });
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, tools: manifest }));
        return;
      }

      if (req.method !== 'POST' || !req.url?.startsWith('/tools/')) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }

      const name = decodeURIComponent(req.url.split('/')[2] ?? '');
      const tool = registry[name];
      if (!tool) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: `Unknown tool ${name}` }));
        return;
      }

      const body = await readBody(req);
      const parsedInput = tool.inputSchema ? await tool.inputSchema.parseAsync(body) : body;
      const result = await tool.handler(parsedInput);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, result }));
    } catch (err: any) {
      res.statusCode = err?.status && Number.isInteger(err.status) ? err.status : 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: err?.message ?? String(err) }));
    }
  });

  await new Promise<void>((resolve) => app.listen(port, resolve));
  console.log(`HTTP MCP bridge listening on port ${port}`);
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) req.destroy(); // rudimentary guard
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
