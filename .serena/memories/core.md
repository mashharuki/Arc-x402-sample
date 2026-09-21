# kaia-x402-sample — Core

pnpm workspace (`pnpm-workspace.yaml`: `pkgs/*`) demonstrating the x402 HTTP payment protocol
(`@x402/*` packages, v2.23.0) on the Kaia testnet (Kairos, chain id `eip155:1001`).

## Packages (all independent, no cross-package imports)

- `pkgs/client` (`x402client`) — demo script that pays for a protected endpoint via `@x402/axios`.
- `pkgs/server` (`x402server`) — resource server (Hono) that gates `/weather` behind x402 payment middleware.
- `pkgs/facilitator` (`facilitator`) — the x402 facilitator: verifies/settles payments on-chain via viem.

Each package has its own `.env` (from `.env.example`, gitignored) and is run independently with
`pnpm <name> run dev` from repo root (see `mem:suggested_commands`).

## Details by concern

- Tech stack, versions, chain/asset specifics: `mem:tech_stack`
- Commands to run each service / format / lint: `mem:suggested_commands`
- Code style beyond the checked-in `.claude/rules/*`: `mem:conventions`
- What "done" means for a change here: `mem:task_completion`

## Non-obvious invariants

- No test suite exists in this repo yet, despite `.claude/rules/testing.md` describing testing
  conventions — those are aspirational project rules, not yet implemented here.
- Only `pkgs/facilitator` has a `tsconfig.json` / `build`+`start` scripts; `client` and `server`
  run directly via `tsx`/`tsx watch` with no compile step.
- `.env.example` files are excluded from Serena's read permissions (denied by directory rule) —
  use `Read` via the general-purpose tool instead if their contents are ever needed, or ask the user.
