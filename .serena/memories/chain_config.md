# Chain / asset config — where network- and token-specific values live

Status: code targets **Arc Testnet** (`arcTestnet` from `viem/chains`, `eip155:5042002`, native USDC
ERC-20 interface `0x3600000000000000000000000000000000000000`). Migrated from a Kaia Kairos/JPYC
template; leftovers listed below. No shared constants package — values live in separate places.

## Chain identity (3 independent sources — keep in sync)

- `pkgs/server/src/config.ts`: `CHAIN_ID = eip155:${arcTestnet.id}`; also used by `resourceServer.ts` (`register`) and `x402Config[*].network`.
- `pkgs/facilitator/src/config.ts`: `chainInfo = { chain: arcTestnet, chainId }`; `index.ts` registers `exact` + `upto` on `chainInfo.chainId`; viem client uses the chain's default RPC (`http()`, no URL).
- `pkgs/client`: `.env` `CHAIN_ID` (bare number, no `eip155:` prefix) → `eip155:${CHAIN_ID}` in `src/config.ts`.

## Token / asset (must match the on-chain token)

- `ASSET_ADDRESS` env in client and server. Client uses it in `setSpendControls.allowedAssets`.
- Hardcoded in `pkgs/server/src/config.ts` `x402Config`: `price.amount` (atomic units) and `price.extra` `{ name, version }`.
- `extra` is the token's **EIP-712 domain**; it must equal on-chain `name()`/`version()`, otherwise the facilitator's verify reverts with `FiatTokenV2: invalid signature` (x402 labels it `invalid_exact_evm_token_version_mismatch`).
- Arc USDC (measured on-chain): `name()="USDC"`, `version()="2"` (not "1"), `decimals()=6` → 0.5 USDC = `"500000"`. When switching token, read `name/version/decimals/DOMAIN_SEPARATOR` via RPC rather than guessing.
- `payTo` = server `EVM_ADDRESS` env. Facilitator signer = `EVM_PRIVATE_KEY` env (needs native gas on the target chain).

## upto (Permit2) on Arc Testnet

- Permit2 `0x000000000022D473030F116dDEE9F6B43aC78BA3`, `x402UptoPermit2Proxy` `0x4020A4f3b7b90ccA423B9fabCc0CE57C6C240002`, `x402ExactPermit2Proxy` `0x402085c248EeA27D92E8b30b2C58ed07f9E20001` are all deployed (verified via `getCode`).
- Client needs USDC allowance to Permit2 (`approve` script) and gas; server does not declare gas-sponsoring extensions. Actual settle amount: `setSettlementOverrides(c, { amount })` (must be <= authorized max).
- Server `GET /usage` amounts: `USAGE_MAX_AMOUNT` (cap) and `USAGE_UNIT_PRICE` in `server/src/config.ts`; `ASSET_EXTRA` is shared by both routes.

## Leftovers from the Kaia template (still stale)

- `pkgs/client/.env.example` `CHAIN_ID=1001` and `pkgs/server/.env.example` `ASSET_ADDRESS` = JPYC — `pnpm setup` copies these, so fresh setups get Kaia values.
- Comments `// Kaia testnet - Exact|Upto` in `facilitator/src/index.ts`; stale `84532` (Base Sepolia) comment in `server/src/resourceServer.ts`.
- Root `package.json` `name: kaia-x402-sample` (Serena project name derives from it).
