# Suggested Commands

Run from repo root unless noted. macOS (Darwin) — standard BSD variants of `grep`/`find`/`sed` apply
(e.g. `sed -i ''` requires the empty string arg on macOS, unlike GNU sed).

## Setup

```bash
pnpm i
cp pkgs/client/.env.example pkgs/client/.env
cp pkgs/server/.env.example pkgs/server/.env
cp pkgs/facilitator/.env.example pkgs/facilitator/.env
```

## Run services (each in its own terminal, in this order)

```bash
pnpm facilitator run dev   # facilitator on :4022
pnpm x402server run dev    # resource server on :4021
pnpm x402client run dev    # one-shot client script (pays and exits)
```

Or run facilitator + server together in the background (PID/logs in `.run/`, gitignored):
```bash
pnpm setup   # copies .env.example -> .env for all three packages
pnpm start   # scripts/start.sh
pnpm stop    # scripts/stop.sh
```

Health checks:
```bash
curl http://localhost:4022/supported   # facilitator (also /health)
curl http://localhost:4021/health      # server
```

## Format / Lint (Biome, repo-wide)

```bash
pnpm format   # biome format --write .
pnpm check    # biome check --write . (lint + format)
```

## Facilitator-only build (not needed for `dev`)

```bash
pnpm facilitator run build   # tsc -> dist/
pnpm facilitator run start   # node dist/index.js
```

There is no test runner configured in this repo (see `mem:core`).
