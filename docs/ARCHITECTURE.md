# MCP Socrata SODA Server (Draft)

- `src/index.ts` — bootstrap and tool registration.
- `src/config.ts` — domain-level auth/limits (optional pre-warm list; any domain accepted at call time).
- `src/httpClient.ts` — shared HTTP client with retries/timeouts (stubbed).
- `src/soqlBuilder.ts` — structured → SoQL query string.
- `src/rateLimiter.ts` — placeholder bucket for per-domain quotas.
- `src/cache.ts` — tiny LRU for metadata/results.
- `src/tools/` — individual tool implementations (list, metadata, preview, query). Example public dataset used in docs/tests: NYC 311 (`erm2-nwe9` on `data.cityofnewyork.us`).
- `src/limits.ts` — shared clamping defaults; used by tools.
- `src/schemas.ts` — JSON Schemas for tool inputs (ready for MCP registration).
- `src/clients.ts` — domain-to-HttpClient registry helpers.
- `src/mcpServer.ts` — builds tool definitions for MCP runtimes.
- `src/index.ts` — boots an MCP stdio server using @modelcontextprotocol/sdk.
- `tests/` — unit/contract tests; e2e against a public dataset is opt-in via `RUN_E2E=true`.

Next steps: strengthen SoQL validation/allowlists, enable persistent caching/metrics, and expand CI to run e2e with a stable app token.
