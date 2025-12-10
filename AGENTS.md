# Repository Guidelines

## Project Structure & Module Organization
- Runtime code lives in `src/` (entry points, MCP server wiring, tool handlers); keep modules small and single-purpose.
- Store agent/tool presets in `agents/` with a short README describing inputs and outputs.
- Mirror source paths under `tests/` with `.spec.ts` files so every module is covered.
- Put repeatable utilities in `scripts/`; keep them idempotent and add `--help`.
- Document decisions in `docs/` and keep sample payloads in `fixtures/`.

## Build, Test, and Development Commands
- `pnpm install` — install dependencies (Node.js 20+). Lockfile must be committed.
- `pnpm dev` — start the local MCP server with hot reload (adapt the command to your entry point).
- `pnpm test` — run the full Vitest suite; add `--watch` for TDD loops.
- `pnpm lint` / `pnpm format` — run ESLint and Prettier; fix lint warnings before opening a PR.
- `pnpm typecheck` — run `tsc --noEmit` to keep types strict.

## Coding Style & Naming Conventions
- Language: TypeScript, strict mode enabled; 2-space indentation; single quotes; trailing commas where Prettier applies.
- Filenames: kebab-case for modules (`agent-registry.ts`); PascalCase for classes/types; camelCase for variables/functions.
- Prefer named exports; use a default only when the module exposes one primary construct.
- Isolate I/O (network, filesystem) behind adapters in `src/infra/`; keep business logic pure.

## Testing Guidelines
- Test framework: Vitest. Co-locate tests with the source they cover: `src/tools/file.ts` → `tests/tools/file.spec.ts`.
- Use fakes over mocks; add contract-style tests for MCP tool inputs/outputs. Store fixtures in `fixtures/`.
- Aim for ≥80% statement coverage; explain any drop in the PR.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat: add url scraper tool`, `fix: handle 429 retries`). Use `!` for breaking changes.
- Keep PRs focused and under ~400 LOC when feasible. Include purpose, key changes, tests run (`pnpm test`, `pnpm lint`), and screenshots/logs when helpful.
- Link issues in the PR body and reference ADRs when relevant. Rebase onto `master` before requesting review.

## Security & Configuration Tips
- Never commit secrets or tokens. Use `.env.example` to document required variables; load via `dotenv` in dev only.
- Validate external inputs (especially tool arguments) with typed schemas (e.g., Zod) and fail fast.
- Pin dependencies in `pnpm-lock.yaml`; run `pnpm audit` and patch in a dedicated PR.
