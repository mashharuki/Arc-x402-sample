# Tech Stack

- Package manager: pnpm (root pins `pnpm@10.32.1`; individual packages pin `pnpm@10.33.0` — inconsistent, not yet unified).
- Language: TypeScript, run directly via `tsx` (no build step for client/server; facilitator has `tsc` build).
- Web framework: Hono (`hono`, `@hono/node-server`) for both `server` and `facilitator` HTTP APIs.
- x402 protocol libs: `@x402/core`, `@x402/evm`, `@x402/avm`, `@x402/svm`, `@x402/hono`, `@x402/axios`, `@x402/fetch`, `@x402/extensions` — all pinned to `^2.23.0`.
- Chain interaction: `viem` (`^2.55.19`), chain object `kairos` from `viem/chains` (Kaia testnet).
- Current chain in code: Kaia Kairos (`kairos` from `viem/chains`, `eip155:1001`) — chain/asset wiring and migration notes in `mem:chain_config`.
- Payment scheme: `exact` (client/server/facilitator) and `upto` (facilitator only, via `UptoEvmScheme`).
- Payment asset: taken from `ASSET_ADDRESS` env (client + server); `.env.example` defaults to JPYC. Amount/decimals and EIP-712 `extra` are hardcoded in `pkgs/server/src/config.ts`.
- Client deps include `@coinbase/cdp-sdk` (+ a `cdp-sdk: link:` entry) but no client source imports it.
- Formatter/linter: Biome 2.5.10 (`biome.json` at repo root, `useIgnoreFile: true`, double quotes, organizeImports on).
- Facilitator signer: built via `toFacilitatorEvmSigner` (`@x402/evm`) wrapping a viem wallet client extended with `publicActions`; account from `EVM_PRIVATE_KEY` env var.
- Client signer: plain viem `privateKeyToAccount` from `EVM_PRIVATE_KEY` env var (see `pkgs/client/src/viem.ts`).
