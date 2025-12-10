# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains all runtime code: `index.ts` bootstraps the MCP server, `httpServer.ts` exposes the HTTP bridge, `tools/` holds Socrata SODA tools (list, metadata, preview, query), and helpers live in `clients.ts`, `config.ts`, `limits.ts`, `soqlBuilder.ts`, `cache.ts`, `rateLimiter.ts`.
- `tests/` mirrors source modules (unit + integration) with optional live e2e under `tests/e2e/` gated by env flags.
- `docs/ARCHITECTURE.md` captures design notes; `README.md` is the user-facing quickstart; `AGENTS.md` is the contributor guide you’re reading.
- Deployment files: `Procfile` (Heroku), `.env.example` (documented env), `pnpm-lock.yaml` (pinned deps).

## Build, Test, and Development Commands
- `pnpm install` (Node 20+); if sandboxed, set `PNPM_HOME=/tmp/pnpm PNPM_STORE_PATH=/tmp/pnpm-store`.
- `pnpm build` → emits JS to `dist/`; `pnpm start` runs the stdio MCP server; `PORT=3000 pnpm start` exposes the HTTP bridge (Heroku/local).
- `pnpm test` runs Vitest suites; `RUN_E2E=true pnpm test` exercises live SODA calls; `RUN_E2E_MCP=true pnpm test` hits the MCP bridge.
- `pnpm typecheck` for strict TS; add `pnpm lint` if/when eslint is added.

## Coding Style & Naming Conventions
- TypeScript in strict mode; 2-space indent; single quotes; prefer named exports.
- Validate all external inputs with Zod schemas; never concatenate raw user strings into SoQL without allowlisting/validation.
- Keep tool handlers thin: parse input → call domain client → return JSON-safe payload. Shared limits/clamping must come from `limits.ts`.
- Avoid side effects; tools are read-only by design—do not add write endpoints without ADR + tests.

## Testing Guidelines
- Framework: Vitest. Mirror paths (`src/tools/queryDataset.ts` → `tests/tools/queryDataset.spec.ts`).
- Use fakes over network stubs; live calls stay behind `RUN_E2E*` flags. Include dataset `domain` and `uid` in fixtures to mirror real use.
- Add regression tests for: auth overrides, rate limiting, SoQL builder safety, limit/offset clamping, and HTTP bridge responses.

## Commit & Pull Request Guidelines
- Conventional Commits (`feat:`, `fix:`, `chore:`). Keep commits small and reviewable; one feature per commit.
- PR checklist: purpose, key changes, tests run (`pnpm test` + any `RUN_E2E*`), and curl examples if behavior changed. Rebase before requesting review.

## Security & Configuration Tips
- Never commit tokens. `SODA_DOMAINS` is optional (pre-warms clients); any domain may be used at call time. Global defaults: `SODA_APP_TOKEN` and `SODA_REQUESTS_PER_HOUR`; per-call overrides: `appToken`, `username`/`password`, `bearerToken`. HTTP bridge gate: `HTTP_API_KEYS` (expects `X-API-Key`).
- Dataset domain is passed as `domain`; dataset id as `uid` on metadata/preview/query tools. Invoke over HTTP with `POST /tools/{tool}` and JSON body, or via MCP stdio transport.
