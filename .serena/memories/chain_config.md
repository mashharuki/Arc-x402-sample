# Chain / asset config — where network- and token-specific values live

Status: README targets **Arc Testnet**, code is still the Kaia Kairos template (`viem/chains` `kairos`,
JPYC). Switching networks means touching every spot below; there is no shared constants package.

## Chain identity (3 independent sources — keep in sync)

- `pkgs/server/src/config.ts`: `CHAIN_ID = eip155:${kairos.id}`; also consumed by `resourceServer.ts` (`register`) and `x402Config[*].network`.
- `pkgs/facilitator/src/config.ts`: `chainInfo = { chain: kairos, chainId }`; `index.ts` registers `exact` + `upto` schemes on `chainInfo.chainId`; viem client uses `chainInfo.chain`'s default RPC (`http()` with no URL). Chain missing from `viem/chains` → needs `defineChain`.
- `pkgs/client`: `.env` `CHAIN_ID` (bare number, no `eip155:` prefix) → `eip155:${CHAIN_ID}` in `src/config.ts`.

## Token / asset (env-driven, plus hardcoded token specifics in server)

- `ASSET_ADDRESS` env in **client** and **server** (`.env.example` still holds the JPYC address). Client uses it in `setSpendControls.allowedAssets`.
- Hardcoded in `pkgs/server/src/config.ts` and token-specific: `price.amount` (`"10000000000000000000"` = 10 × 10^18, assumes 18 decimals) and `price.extra` `{ name: "JPY Coin", version: "1" }` (must match the asset's EIP-712 domain). Change these with the asset.
- `payTo` = server `EVM_ADDRESS` env. Facilitator signer = `EVM_PRIVATE_KEY` env (needs native gas on the target chain).

## Leftover names to fix during migration

- Root `package.json` `name: kaia-x402-sample` (Serena project name derives from it).
- Comments `// Kaia testnet - Exact|Upto` in `facilitator/src/index.ts`; `// JPYC` in client/server config.
- Stale comment in `server/src/resourceServer.ts` says chain id 84532 (Base Sepolia) — wrong for any current config.
