# Privy wallet + MCP server (design notes, not implemented yet)

Goal: MCP server so Claude Code can run the x402 demo; wallets created per user via Privy.

## Installed skill
- `privy-io/privy-agentic-wallets-skill@privy` (MIT, official org), project scope: real dir `.agents/skills/privy`, symlink `.claude/skills/privy`, lock `skills-lock.json`.
- Installer flagged Gen/Snyk "Med Risk", Socket "1 alert"; manual review found only REST `curl` docs using APP_SECRET + injection warnings, no scripts. Its README points at a personal fork (`tedim52/...`) — never clone from README.
- Added `model: opus` to its SKILL.md frontmatter (project rule); differs from `computedHash` in the lock, `skills update` will overwrite it.
- Skill is OpenClaw/REST oriented and only shows `eth_sendTransaction` policy examples; for typed data use Privy docs (Context7 `/llmstxt/privy_io_llms_txt`).

## Verified from Privy docs (not yet run here)
- Node SDK `@privy-io/node`: `users().create`, `wallets().create({ chain_type: "ethereum", owner: { user_id } })`, `wallets().ethereum().signTypedData(walletId, ...)`, `createViemAccount` from `@privy-io/node/viem` (optional `authorizationContext`).
- Policies apply to `eth_signTypedData_v4` too: `ethereum_typed_data_domain` (chainId, verifyingContract) and `ethereum_typed_data_message` (field path + operators like `lte`/`in`). The policy's `types` map must match the client's request exactly (incl. `EIP712Domain`, field order) or the condition is false → use ALLOW-only allowlist rules, not DENY rules.
- User-owned wallets need user JWT / additional signers for server-side actions; app-owned wallets are signed with the app's authorization key.

## Unverified
- Whether Privy can broadcast on Arc Testnet (5042002); fallback: sign with Privy, send via own viem transport.
- Whether the viem account from `createViemAccount` satisfies x402's `ClientEvmSigner` (`address` + `signTypedData`) for Permit2 / ERC-3009.
- Policy `types` map for the Permit2 witness typed data emitted by `@x402/evm` upto client.

## Constraint
- `PRIVY_APP_SECRET` must never reach workshop attendees; per-attendee wallets need a server holding the secret (e.g. Cloudflare Worker), not a local stdio MCP per attendee.
