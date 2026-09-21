# Privy wallet + MCP server (`pkgs/mcp`)

Goal: MCP server so Claude Code can run the x402 demo; Privy **user-owned** wallets per user. Local (stdio) first; Cloudflare Workers later.

## Status
- Implemented (type-checked, smoke-tested over stdio without credentials): tools `wallet_status`, `wallet_login_start`, `wallet_login_verify`, `set_budget` (confirm two-step), `pay_and_fetch` (path allowlist).
- NOT yet run against a real Privy app: headless email OTP in Node, `wallets().create` with `owner` + `additional_signers`, policy matching, signing via `createViemAccount`, approve broadcast on Arc.
- `pkgs/mcp/.env.example` could not be written (permission deny on `.env.example`); required keys are documented in README.

## Flow
- Login: `@privy-io/js-sdk-core` (`Privy` default export, own `Storage` impl) `auth.email.sendCode/loginWithCode`. User JWT is NOT kept.
- Wallet: app credentials (`@privy-io/node`) create a P-256 delegate key locally -> `keyQuorums().create({ public_keys })` -> `policies().create` -> `wallets().create({ owner: { user_id }, additional_signers: [{ signer_id, override_policy_ids }] })`. State in `~/.x402mcp/wallet.json` (0600).
- Signing: `createViemAccount` (viem LocalAccount-compatible; type-checks as an x402 signer). Privy's `createX402Client` only registers `exact` (not `upto`), so we register `ExactEvmScheme` + `UptoEvmScheme` ourselves.
- Transactions: signed by Privy (`eth_signTransaction`), broadcast by our own viem RPC client (no dependence on Privy supporting Arc).

## Policy (ALLOW-only, in `src/policy.ts`)
- Typed data uses `ethereum_typed_data_domain` / `ethereum_typed_data_message`; the policy `types` map must match the signing request exactly (incl. `EIP712Domain` and field order) or the condition is false -> with ALLOW-only rules that means deny (fail closed). Types come from `@x402/evm` constants (`uptoPermit2WitnessTypes`, `authorizationTypes`) WITHOUT `EIP712Domain`; if a legit signature is denied, try adding `EIP712Domain`.
- `approve` calldata (spender/amount) is NOT policy-checked (only `to`=token, value 0, chain id); limits rely on `MAX_BUDGET` in the MCP and Claude Code's tool permission prompt.

## Constraints / gotchas
- `PRIVY_APP_SECRET` can create wallets for every user: never give it to workshop attendees -> per-attendee wallets need a server holding it (Cloudflare Worker).
- MCP stdio: never write to stdout; register with `pnpm --dir <pkg> exec tsx src/index.ts` (`pnpm dev` prints a banner to stdout).
- Privy docs source: Context7 `/llmstxt/privy_io_llms_txt`. Installed skill `privy-io/privy-agentic-wallets-skill` (`.agents/skills/privy`, symlinked in `.claude/skills/privy`) is REST/app-owned oriented; installer flagged Med Risk (manual review found no scripts); README points to a personal fork — do not clone from it.
