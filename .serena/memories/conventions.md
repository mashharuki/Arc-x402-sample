# Conventions (beyond `.claude/rules/*`)

The checked-in `.claude/rules/code-style.md`, `git-workflow.md`, `testing.md`, `security.md` already
govern generic style/workflow and are auto-loaded as project instructions — do not duplicate them here.
This memory only covers patterns specific to this codebase that those rules don't mention:

- Comments are written in Japanese in existing source (e.g. `pkgs/server/src/config.ts`,
  `pkgs/facilitator/src/index.ts`) — match this when editing those files.
- Facilitator lifecycle hooks (`onBeforeVerify`, `onAfterVerify`, `onVerifyFailure`,
  `onBeforeSettle`, `onAfterSettle`, `onSettleFailure` in `pkgs/facilitator/src/index.ts`) log with a
  `================ <Stage> ================` banner style — follow this if adding more hooks.
- Error responses in Hono route handlers follow a consistent shape:
  `c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500)`.
- Chain id string literal `"eip155:1001"` is duplicated across `client/src/config.ts`,
  `server/src/config.ts` (as `CHAIN_ID`), and `facilitator/src/viem.ts` (as `chainInfo.chainId`) —
  there is no shared constants package; when changing the network, update all three independently.
