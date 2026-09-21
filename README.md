# Arc-x402-sample

This repo is sample code for Arc Testnet x402 

## setup

```bash
pnpm i
```

```bash
cp pkgs/client/.env.example pkgs/client/.env
cp pkgs/server/.env.example pkgs/server/.env
cp pkgs/facilitator/.env.example pkgs/facilitator/.env
```

## How to work

1. start facilitator 

```bash
pnpm facilitator run dev
```

Please check it

```bash
curl http://localhost:4022/supported | jq
```

```json

```

2. x402 backend server(Resource server)

```bash
pnpm x402server run dev
```

Please check it

```bash
curl http://localhost:4021/health | jq
```

3. run client script

```bash
pnpm x402client run dev
```

example result:

```bash

```
