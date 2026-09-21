# Task Completion Checklist

1. `pnpm check` (Biome lint + format, repo root) — fix any reported issues.
2. No type-checker or test runner is wired up for `client`/`server` (no `tsconfig.json`, no test
   files anywhere in the repo). For `facilitator`, `pnpm facilitator run build` (`tsc`) can be used
   as an ad-hoc type check since it has a `tsconfig.json`.
3. Manually verify behavior by running the three services per `mem:suggested_commands` (facilitator
   → server → client) and checking the health/supported endpoints, since there is no automated test
   suite to rely on.
4. Do not commit `.env` files (already gitignored per-package) or hardcode secrets — see
   `.claude/rules/security.md`.
