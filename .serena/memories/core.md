# Arc-x402-sample — Core

pnpm workspace (`pnpm-workspace.yaml`: `pkgs/*`) demonstrating the x402 HTTP payment protocol
(`@x402/*` packages, ^2.23.0). README says the target is **Arc Testnet**, but the code is still the
Kaia Kairos (`eip155:1001`, JPYC) template — migration in progress, see `mem:chain_config`.

## Packages (all independent, no cross-package imports)

- `pkgs/client` (`x402client`) — one-shot script that pays for a protected endpoint via `@x402/axios`.
- `pkgs/server` (`x402server`) — Hono resource server on :4021 gating `GET /weather` behind x402 middleware.
- `pkgs/facilitator` (`facilitator`) — Hono x402 facilitator on :4022 (`/verify`, `/settle`, `/supported`, `/health`); verifies/settles on-chain via viem.

Each package has its own gitignored `.env` (from `.env.example`). `scripts/` (`setup.sh`, `start.sh`,
`stop.sh`; root `pnpm setup|start|stop`) copy env files / run facilitator+server in background
(PID + logs in gitignored `.run/`).

## Details by concern

- Network/asset-specific values and what to change when switching chain or token: `mem:chain_config`
- Tech stack, versions, signer construction, payment schemes: `mem:tech_stack`
- Commands to set up / run each service / format / lint: `mem:suggested_commands`
- Codebase-specific style beyond `.claude/rules/*`: `mem:conventions`
- What "done" means for a change here: `mem:task_completion`

## Non-obvious invariants

- No test suite exists, despite `.claude/rules/testing.md` — those rules are aspirational here.
- Only `pkgs/facilitator` has `tsconfig.json` + `build`/`start`; `client` and `server` run via `tsx` only (no compile, no type-check).
- `.env.example` files are denied to Serena's read tools — use the general `Read` tool or ask the user.
