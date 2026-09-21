# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ETH Skill

Read https://ethskills.com/SKILL.md and follow it before writing Solidity or shipping anything onchain.

## Overview

Sample of the x402 HTTP payment protocol (`@x402/*` ^2.23.0) as a pnpm workspace (`pkgs/*`). It targets **Arc Testnet** (`arcTestnet` from `viem/chains`, `eip155:5042002`, USDC), migrated from a Kaia Kairos/JPYC template that still leaves some stale values (see below). Serena memories in `.serena/memories/` (start at `core`) hold more detail.

## Commands

Run from the repo root. The three packages are addressed through root scripts: `pnpm facilitator`, `pnpm x402server`, `pnpm x402client` (each is `pnpm --filter <pkg>`).

```bash
pnpm i
pnpm setup                     # copies pkgs/*/.env.example -> .env (fill in EVM_PRIVATE_KEY etc.)

pnpm facilitator run dev       # :4022  (tsx watch)
pnpm x402server run dev        # :4021  (tsx watch)
pnpm x402client run dev        # one-shot: requests PAYWALL_PATH, pays, prints result
pnpm x402client run approve [amount] [--execute]  # USDC allowance to Permit2 (upto budget); dry-run without --execute
pnpm x402client run guardrails # upto guardrail scenarios against a running facilitator + server

pnpm start / pnpm stop         # facilitator + server in background; PID/logs in .run/
pnpm check                     # biome check --write . (lint + format); pnpm format = format only
pnpm facilitator run build     # tsc -> dist/ (only package with a tsconfig)

curl localhost:4022/supported  # facilitator; also /health, POST /verify, POST /settle
curl localhost:4021/health
```

There is no test suite, and `client`/`server` have no type-check step (`tsx` only). The facilitator's `tsc` build is the only available type check. Start order matters: facilitator → server → client.

## Architecture

Three independent packages with no cross-imports; they communicate only over HTTP:

1. **client** — `@x402/axios` wraps an axios instance. On a 402 response it signs a payment with a viem account (`EVM_PRIVATE_KEY`) and retries.
2. **server** — Hono app with `paymentMiddleware(x402Config, resourceServer)` gating `GET /weather`. Pricing/route config is `x402Config` in `pkgs/server/src/config.ts`. It never touches the chain itself: `HTTPFacilitatorClient` (`FACILITATOR_URL`) delegates verification and settlement.
3. **facilitator** — Hono app exposing `/verify`, `/settle`, `/supported`. It registers `exact` and `upto` (`UptoEvmScheme`) schemes on one chain, and settles on-chain through a viem wallet client wrapped by `toFacilitatorEvmSigner` (`src/viem.ts`). Lifecycle hooks (`onBefore*`, `onAfter*`, `on*Failure`) in `src/index.ts` log with `================ Stage ================` banners.

### `upto` (usage-based) guardrails

Server route `GET /usage?units=N` uses the `upto` scheme: the client authorizes a maximum via a Permit2 signature (`USAGE_MAX_AMOUNT`), and the handler settles only `units × USAGE_UNIT_PRICE` through `setSettlementOverrides`. The handler deliberately does not clamp to the maximum, so over-cap settlement can be verified to fail. Two enforcement layers: the per-payment maximum in the Permit2 signature, and the total budget = the token's ERC-20 allowance to Permit2 (set with `approve`; never `maxUint256`). The client also caps signing itself via `createPaymentClient(maxAmountPerPayment)` (default 1 USDC, env `MAX_AMOUNT_PER_PAYMENT`). Gas-sponsoring extensions are not declared, so the client must hold the allowance and gas itself.

### Chain/asset config is duplicated, not shared

Switching network or token requires editing three places independently — chain in `server/src/config.ts` and `facilitator/src/config.ts` (both import `arcTestnet`), and `CHAIN_ID` (bare number, no `eip155:` prefix) in the client `.env`. The token comes from `ASSET_ADDRESS` (client + server env), but `price.amount` and `extra: { name, version }` are hardcoded in `server/src/config.ts` and must match the on-chain token. `extra` is the token's EIP-712 domain: a wrong `version` makes the facilitator's verify revert with `FiatTokenV2: invalid signature`. Arc USDC is `name="USDC"`, `version="2"`, `decimals=6`; read these from the contract when changing token.

Stale Kaia leftovers: `.env.example` files (`CHAIN_ID=1001`, JPYC `ASSET_ADDRESS` — `pnpm setup` copies them), `// Kaia testnet` comments in `facilitator/src/index.ts`, the `84532` comment in `server/src/resourceServer.ts`, and the root package name `kaia-x402-sample`.

## Conventions specific to this repo

- Source comments are in Japanese; match that when editing existing files.
- Route error responses use `c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500)`.
- `.env.example` files are denied to Serena's read tools; use the general `Read` tool.
- `.claude/rules/testing.md` describes test conventions, but no tests exist yet, so they are aspirational.
- Both package.json files pin different `pnpm` versions (root 10.32.1, packages 10.33.0); not yet unified.
