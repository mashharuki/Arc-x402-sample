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
- Facilitator routes (`/verify`, `/settle`, `/supported`) wrap the body in try/catch and return the error shape above.
- Chain/network values are not shared across packages — see `mem:chain_config` before changing them.
