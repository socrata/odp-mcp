# Socrata SODA MCP Server

Lightweight Model Context Protocol server that exposes read-only tools for Socrata’s SODA API (dataset search, metadata, preview, and structured queries).

## Setup
```bash
pnpm install
cp .env.example .env   # edit domains/tokens
pnpm build
pnpm start             # runs stdio MCP server
```

Environment variables:
- `SODA_DOMAINS`: comma-separated Socrata domains (e.g. `data.cityofnewyork.us`)
- `SODA_APP_TOKEN`: optional app token applied to all domains
- `SODA_REQUESTS_PER_HOUR`: optional client-side throttle per domain

## Tools
- `list_datasets(domain, query?, limit?)`
- `get_metadata(domain, uid)`
- `preview_dataset(domain, uid, limit?)`
- `query_dataset(domain, uid, select?, where?, order?, group?, having?, limit?, offset?)`

Defaults and guards:
- Limits clamp to max 5000 rows; offsets clamp to 50,000.
- Preview default limit: 50. Query default limit: 500.
- Client-side rate limiter if `SODA_REQUESTS_PER_HOUR` is set.

## Development
```bash
pnpm test          # unit tests; e2e skipped by default
RUN_E2E=true pnpm test   # includes live call to NYC 311 dataset
pnpm exec tsc --noEmit   # type-check
pnpm exec tsc --noEmit --watch   # optional faster inner-loop typecheck
# Optional MCP e2e (live): RUN_E2E_MCP=true pnpm test
```

## Notes
- Transport: stdio via `@modelcontextprotocol/sdk`; server name `socrata-soda-mcp`.
- Responses are serialized as JSON text to satisfy SDK content typings; callers should parse the text payload.
- Write operations are intentionally excluded; extend tools with strong validation before enabling Producer APIs.
- E2E tests are opt-in to avoid network flakiness; set `RUN_E2E=true` to exercise a live Socrata dataset.
- HTTP bridge extras: `GET /healthz`, `GET /tools` (manifest), HTTPS redirect when behind proxy, optional API key gate via `HTTP_API_KEYS` (uses `X-API-Key`).
- Optional manifest integrity: set `MANIFEST_SHA256` (sha256 of sorted tool names) to fail closed on mismatch.
- Per-call auth overrides supported on every tool: `appToken`, `username`+`password` (basic), or `bearerToken`.
- SoQL safety: identifiers validated; limit/offset clamped; `$query` only used when structured clauses present.
- Rate limiting: optional per-domain client bucket (`SODA_REQUESTS_PER_HOUR`); HTTP client retries 429/5xx with backoff.

## Implementation Details & Behavior
- Tools:
  - `list_datasets`: catalog search with `domains` filter. Example `{domain:"data.cityofnewyork.us", query:"311", limit:5}`.
  - `get_metadata`: `/api/views/{uid}.json`, cached via LRU (keyed by domain+uid). Example `{domain:"data.cityofnewyork.us", uid:"nc67-uf89"}`.
  - `preview_dataset`: `/resource/{uid}.json` with `$limit`; default 50, max 5000. Example `{domain:"data.cityofnewyork.us", uid:"nc67-uf89", limit:20}`.
  - `query_dataset`: structured SoQL builder; uses `$query` only when select/where/order/group/having present, otherwise `$limit/$offset`. Defaults limit 500 (max 5000), offset 0 (max 50k). Example `{domain:"data.cityofnewyork.us", uid:"nc67-uf89", select:["unique_key","complaint_type"], where:"borough = 'MANHATTAN'", order:["created_date DESC"], limit:5}`.
- Http client: fetch-based with AbortController timeout, auth headers (app token/basic/bearer), retry (3x exp backoff) on 429/5xx, optional client-side rate limiter (`requestsPerHour`), JSON parsing, and header normalization.
- Clamping: shared in `src/limits.ts` (limit max 5000, default query 500, preview 50; offset max 50k).
- Config: env-driven (`SODA_DOMAINS`, `SODA_APP_TOKEN`, `SODA_REQUESTS_PER_HOUR`).
- Caching: metadata LRU size 100.
- Tests: 19 suites (33 tests) including auth/retry/rate-limit, clamping, error bubbling, MCP registration/validation, and optional live e2e (`RUN_E2E`, `RUN_E2E_MCP`).
