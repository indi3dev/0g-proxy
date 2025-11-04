# AGENTS.md

## Build / Lint / Test Commands
- **Build**: `npm run build` (compiles TypeScript to `dist/`)
- **Lint**: `npm run lint` (uses ESLint/Prettier)
- **All tests** `npm test` (runs Jest)
- **Single test**: `npm test -- <path/to/test.spec.ts>` (or `npx jest <file>`)

## Code Style Guidelines
- **Imports**: absolute from `src/`, grouped by third‑party then local, each on its own line.
- **Formatting**: Prettier defaults – 2‑space indent, trailing commas, semi‑colons.
- **TypeScript**: enable `strict`, explicit return types, avoid `any`.
- **Naming**: `camelCase` for variables/functions, `PascalCase` for classes/types.
- **Error handling**: wrap async logic in `try/catch`, log via `utils/logger`, re‑throw custom errors.
- **Async**: always `await` promises, never ignore returned promisen- **Constants**: `const` over `let`, uppercase `SCREAMING_SNAKE_CASE` for env vars.
- **Logging**: use `logger.info/debug/error`; never `console.log` in production code.
- **HTTP**: express handlers must send JSON responses, set proper status codes.
- **Security**: never commit secrets; read from `process.env`.
- **Testing**: use Jest, mock external services, keep tests deterministic.
- **Documentation**: JSDoc comments for exported functions/types.
- **No unused vars**: enable `noUnusedLocals`/`noUnusedParameters`.
- **Commit hooks**: lint & typecheck run before commit (via husky).
