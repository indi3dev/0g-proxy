# AGENTS.md

## Build / Lint / Test Commands
- `npm run build` – compile TypeScript (`tsc`).
- `npm run lint` – run ESLint (if configured) on the codebase.
- `npm run test` – execute tests.
- `npm run test -- -t <testName>` – run a single test by name.
- `npm run dev` – start server with ts-node (hot‑reload).

## Code Style Guidelines
- **Imports**: external modules first, then internal, alphabetical, no unused imports.
- **Formatting**: Prettier defaults – 2‑space indent, trailing commas, semicolons.
- **Types**: use `interface` for object shapes, `type` for unions; explicit return types.
- **Naming**: `camelCase` for vars/functions, `PascalCase` for classes/types, `UPPER_SNAKE_CASE` for constants.
- **Error Handling**: async code in `try/catch`; log via `logger.error` and forward appropriate HTTP status.
- **Logging**: use `logger` utility; avoid `console.log` in production.
- **Async/Await**: prefer over promise chains; always `await` async calls.
- **Exports**: named exports only; avoid default exports.
- **File Structure**: one top‑level export per file when possible; keep related functions together.

## Repository Rules
- No `.cursor` or Copilot instruction files detected; include them here if added.
- Follow existing ESLint/Prettier configs; run `npm run lint -- --fix` before committing.
