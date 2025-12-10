# MCP Socrata SODA Server

## Overview

This is an MCP (Model Context Protocol) server providing read-only access to Socrata SODA datasets.

## Module Structure

- `src/index.ts` — Bootstrap and tool registration using @modelcontextprotocol/sdk
- `src/toolDefinitions.ts` — Unified tool definitions with Zod schemas (single source of truth)
- `src/config.ts` — Domain-level auth/limits and HTTP client settings
- `src/httpClient.ts` — Shared HTTP client with configurable retries/timeouts
- `src/httpServer.ts` — HTTP bridge for non-stdio transports with JSON-RPC support
- `src/soqlBuilder.ts` — Structured → SoQL query string with injection prevention
- `src/rateLimiter.ts` — Token bucket for per-domain rate limiting
- `src/cache.ts` — LRU cache with TTL support for metadata
- `src/auth.ts` — Shared auth override utilities
- `src/limits.ts` — Shared clamping defaults for query limits
- `src/clients.ts` — Domain-to-HttpClient registry helpers
- `src/mcpServer.ts` — Builds tool definitions for custom MCP runtimes
- `src/tools/` — Individual tool implementations:
  - `listDatasets.ts` — Search and list datasets with parallel enrichment
  - `getMetadata.ts` — Fetch dataset metadata with caching
  - `previewDataset.ts` — Preview first N rows
  - `queryDataset.ts` — Run structured SoQL queries

## Test Dataset

Example public dataset used in docs/tests: NYC 311 (`erm2-nwe9` on `data.cityofnewyork.us`).

## Testing

- `tests/` — Unit/contract tests
- E2E tests against public datasets are opt-in via `RUN_E2E=true`

## Environment Variables

### Required (for pre-configured domains)
- `SODA_DOMAINS` — Comma-separated list of Socrata domains

### Optional Authentication
- `SODA_APP_TOKEN` — Default app token for all domains
- `SODA_REQUESTS_PER_HOUR` — Client-side rate limiting

### HTTP Client Configuration
- `SODA_HTTP_TIMEOUT_MS` — Request timeout (default: 15000ms)
- `SODA_HTTP_MAX_RETRIES` — Max retry attempts (default: 3)
- `SODA_HTTP_RETRY_BASE_MS` — Exponential backoff base (default: 100ms)

### HTTP Server
- `PORT` — Run HTTP bridge instead of stdio transport
- `HTTP_API_KEYS` — Comma-separated API keys for HTTP protection

### Security
- `MANIFEST_SHA256` — Optional manifest integrity check

## Known Limitations

### Private API Dependency

The HTTP server (`src/httpServer.ts`) accesses internal MCP SDK structures:

```typescript
const registry = (server as unknown as McpServerInternal)._registeredTools;
```

**Important:** This is an internal implementation detail of `@modelcontextprotocol/sdk` that may change between versions. When upgrading the SDK:

1. Pin the exact SDK version in `package.json`
2. Test HTTP bridge functionality after any SDK upgrade
3. Check if a public API for tool enumeration has been added

## Security Considerations

- **SoQL Injection Prevention:** The `soqlBuilder.ts` validates inputs against dangerous patterns
- **Rate Limiting:** Client-side throttling prevents API abuse
- **Request Size Limits:** HTTP bridge limits request bodies to 512KB
- **HTTPS Enforcement:** HTTP server redirects to HTTPS when behind proxy
