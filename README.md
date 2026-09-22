# Arc-x402-sample

This repo is sample code for Arc Testnet x402 

## setup

```bash
pnpm i
```

```bash
pnpm run setup
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
{
  "kinds": [
    {
      "x402Version": 2,
      "scheme": "exact",
      "network": "eip155:5042002"
    },
    {
      "x402Version": 2,
      "scheme": "upto",
      "network": "eip155:5042002",
      "extra": {
        "facilitatorAddress": "0x3e5fE9717398d98Aae8A8F435Bf8c29C5aa0d18b"
      }
    }
  ],
  "extensions": [],
  "signers": {
    "eip155:*": [
      "0x3e5fE9717398d98Aae8A8F435Bf8c29C5aa0d18b"
    ]
  }
}
```

2. x402 backend server(Resource server)

```bash
pnpm x402server run dev
```

Please check it

```bash
curl http://localhost:4021/health | jq
```

```json
{
  "report": {
    "status": "OK"
  }
}
```

3. run client script

```bash
pnpm x402client run dev
```

example result:

```bash
{ report: { weather: 'sunny', temperature: 70 } }
Response: { report: { weather: 'sunny', temperature: 70 } }
Payment settled: {
  success: true,
  payer: '0xcA341CE4902756bF9e96e145014DD0aB36A0Fe8E',
  transaction: '0xe71f21710aa03a31ebcb87032fea3690761d12836c6800f481b1623f21cadede',
  network: 'eip155:5042002'
}
```

[Arc Testnet Explorer x402決済のトランザクション 0xe71f21710aa03a31ebcb87032fea3690761d12836c6800f481b1623f21cadede](https://explorer.testnet.arc.io/tx/0xe71f21710aa03a31ebcb87032fea3690761d12836c6800f481b1623f21cadede)

## Guardrails with the `upto` scheme

`GET /usage?units=N` on the resource server uses the `upto` scheme (Permit2 based). The client authorizes a **maximum** (0.5 USDC) and the server settles only what was actually consumed (`units` x 0.1 USDC).

Spending is limited by three layers:

| Layer | What limits spending | Where |
|---|---|---|
| Per payment (client) | The client refuses to sign a payment above `MAX_AMOUNT_PER_PAYMENT` (default `1000000` = 1 USDC) | `pkgs/client/src/config.ts` |
| Per payment (signature) | The Permit2 signature authorizes at most the `upto` maximum; the facilitator rejects a larger settlement | `pkgs/server/src/config.ts` |
| Total budget (on-chain) | The USDC allowance granted to Permit2 (never `maxUint256`) | `pkgs/client/src/approve.ts` |

The client needs a small amount of USDC for gas, because the `upto` flow does not use gas-sponsoring extensions.

1. Grant the total budget (2 USDC). Without `--execute` it is a dry-run that only shows the current allowance. `0` revokes the approval

```bash
pnpm x402client run approve 2000000 --execute
```

2. Run the guardrail scenarios (facilitator and server must be running)

```bash
pnpm x402client run guardrails
```

| Scenario | Expected |
|---|---|
| 1. Within the cap (3 units = 0.3 USDC) | Settled, only 0.3 USDC is charged |
| 2. Settlement above the cap (10 units = 1.0 USDC) | Payment is sent, but settlement is rejected |
| 3. Client-side cap (client allows 0.1 USDC, server asks up to 0.5 USDC) | Rejected before signing, no payment is sent |

example result (abridged):

```bash
===== 1. 上限内の使用量 =====
{
  kind: 'response',
  requests: 2,
  status: 200,
  paymentStatus: 'settled',
  body: { report: { units: 3, charged: '300000' } },
  header: {
    success: true,
    payer: '0xcA341CE4902756bF9e96e145014DD0aB36A0Fe8E',
    transaction: '0xd72d264486fbc0924aa5ef111085c0770280db55e3e1351950bc79b11fedcfc1',
    network: 'eip155:5042002',
    amount: '300000'
  }
}

===== 2. 上限を超える決済指定 =====
{
  kind: 'response',
  requests: 2,
  status: 402,
  paymentStatus: 'settle_failed',
  body: {},
  header: {
    success: false,
    errorReason: 'invalid_upto_evm_payload_settlement_exceeds_amount',
    payer: '0xcA341CE4902756bF9e96e145014DD0aB36A0Fe8E',
    transaction: '',
    network: 'eip155:5042002'
  }
}

===== 3. client側の上限による拒否 =====
{
  kind: 'client_error',
  requests: 1,
  message: 'Failed to create payment payload: All payment requirements were rejected by spendControls.allowedAssets maxAmountPerPayment. ...'
}

===== summary =====
PASS  1. 上限内の使用量 - 決済成立(settled)。決済額は header の amount を確認
PASS  2. 上限を超える決済指定 - 支払いは送られたが、決済は成立しなかった
PASS  3. client側の上限による拒否 - 署名前に拒否された: Failed to create payment payload: ...
```

[Arc Testnet Explorer upto決済のトランザクション 0xd72d264486fbc0924aa5ef111085c0770280db55e3e1351950bc79b11fedcfc1](https://explorer.testnet.arc.io/tx/0xd72d264486fbc0924aa5ef111085c0770280db55e3e1351950bc79b11fedcfc1)

Not covered by the script yet: allowance exhaustion (run `approve 0 --execute`, then `guardrails`; restore with `approve 2000000 --execute`) and signature expiry (`maxTimeoutSeconds`, 300 s).

## MCP server for Claude Code (Privy user-owned wallet)

`pkgs/mcp` is a stdio MCP server that lets Claude Code run this demo. Each user gets their own **Privy user-owned wallet**: the user proves their email with a one-time code, the wallet is created with the user as owner, and a locally generated delegate key is added as an additional signer. The delegate key can only sign what the Privy policy allows (payments up to `MAX_AMOUNT_PER_PAYMENT`, only to `ALLOWED_PAYEES`, only on Arc Testnet).

Tools: `wallet_status`, `wallet_login_start`, `wallet_login_verify`, `set_budget` (two steps: preview, then `confirm`), `pay_and_fetch` (only `/weather` and `/usage?units=N`).

### Setup

1. In the [Privy dashboard](https://dashboard.privy.io), enable **Email** login, copy the App ID, App Secret and Client ID, and add `http://localhost:5173` to **Allowed origins** (the MCP server runs on Node, which sends no `Origin` header, so it sets one itself; without a registered origin Privy answers `Must specify origin`).
2. Create `pkgs/mcp/.env` (gitignored) with these keys:

```bash
PRIVY_APP_ID=
PRIVY_APP_SECRET=
PRIVY_CLIENT_ID=
ASSET_ADDRESS=0x3600000000000000000000000000000000000000
# comma separated. Use the x402 server's EVM_ADDRESS (the payTo address)
ALLOWED_PAYEES=
# optional
# must match a value in the Privy dashboard's Allowed origins
PRIVY_ORIGIN=http://localhost:5173
PAYWALL_API_BASE_URL=http://localhost:4021
MAX_AMOUNT_PER_PAYMENT=1000000
```

3. Start the facilitator and the server (`pnpm start`), then register the MCP server with Claude Code (do not use `pnpm dev`: its banner would be written to stdout, which is the MCP protocol channel). Either way works:

   - With the CLI:

     ```bash
     claude mcp add x402-arc-demo -- pnpm --dir "$(pwd)/pkgs/mcp" exec tsx src/index.ts
     ```

   - With an MCP config file (`.mcp.json` at the repo root, or `.claude/.mcp.json` passed via `claude --mcp-config .claude/.mcp.json`). Replace `<repo>` with the absolute path of this repository, because relative paths depend on the directory Claude Code is started from:

     ```json
     {
       "mcpServers": {
         "x402-arc-demo": {
           "type": "stdio",
           "command": "pnpm",
           "args": ["--dir", "<repo>/pkgs/mcp", "exec", "tsx", "src/index.ts"]
         }
       }
     }
     ```

   Secrets stay in `pkgs/mcp/.env`; do not put `PRIVY_APP_SECRET` in the config file. After changing the MCP code or `.env`, reconnect with `/mcp` so the server restarts.

4. Ask Claude Code: "Check my wallet status and pay for /usage?units=3". It will guide you through the email login, then you fund the printed address with testnet USDC and set a budget.

The wallet address and the delegate key are stored in `~/.x402mcp/wallet.json` (mode 0600). The app secret can create wallets for every user of the app, so keep it on your machine or on a server; never share it with workshop attendees.

### Try every tool in one prompt

Once connected (stdio `x402-arc-demo` or the remote `x402-arc-demo` over HTTP, same tools either way), paste this into Claude Code to exercise all five tools in one pass, including the `upto` cap-exceeded rejection from the [Guardrails](#guardrails-with-the-upto-scheme) section above:

> Check my wallet status. If I don't have a wallet yet, walk me through logging in with my email and creating one, then tell me the address to fund. Once it's funded with testnet USDC, set my budget to 2000000 (2 USDC) — ask me to confirm the amount first, then actually set it. After that:
> 1. Pay for `/weather` (exact scheme, 0.5 USDC) and show me the result.
> 2. Pay for `/usage?units=3` (upto scheme, 0.3 USDC, within the 0.5 USDC authorized cap) and show me the settled amount.
> 3. Pay for `/usage?units=10` (upto scheme, this asks for 1.0 USDC, which is above the 0.5 USDC cap I signed) and show me what happens.
> Show my balance and allowance before and after each step.

Expected: steps 1–2 settle normally. Step 3's payment is sent (the signature only authorizes up to 0.5 USDC, so it still gets created), but settlement fails — the facilitator rejects it with something like `invalid_upto_evm_payload_settlement_exceeds_amount`, the same over-cap guardrail the `pnpm x402client run guardrails` script demonstrates, now triggered through natural language over MCP.

## Deploy to Cloudflare Workers

### setup secret

```bash
pnpm --filter facilitator exec wrangler secret put EVM_PRIVATE_KEY
pnpm --filter x402mcp exec wrangler secret put PRIVY_APP_SECRET
```

### Deploy to Cloudflare Workers

Before deploying, fill in the public (non-secret) values: `ASSET_ADDRESS` and `EVM_ADDRESS` in `pkgs/server/wrangler.jsonc`, and `PRIVY_APP_ID`, `PRIVY_CLIENT_ID`, `ASSET_ADDRESS`, `ALLOWED_PAYEES` in `pkgs/mcp/wrangler.jsonc`. Full checklist and operational caveats: [`docs/cloudflare-deploy.md`](docs/cloudflare-deploy.md).

Deploy in order, copying each printed URL into the next config before deploying it:

```bash
# 1. facilitator
pnpm deploy:facilitator
# copy the printed URL into pkgs/server/wrangler.jsonc -> vars.FACILITATOR_URL

# 2. server
pnpm deploy:server
# copy the printed URL into pkgs/mcp/wrangler.jsonc -> vars.PAYWALL_API_BASE_URL

# 3. mcp
pnpm deploy:mcp
# copy the printed URL into pkgs/mcp/wrangler.jsonc -> vars.PRIVY_ORIGIN,
# add that origin to the Privy dashboard's Allowed origins, then redeploy
pnpm deploy:mcp
```

Verify:

```bash
curl -s <facilitator-url>/supported
curl -s <server-url>/health
curl -s -i <server-url>/weather        # expect 402
```

Register the remote mcp Worker with Claude Code. Either way works:

- With the CLI:

  ```bash
  claude mcp add --transport http x402-arc-demo <mcp-url>/mcp
  ```

- With an MCP config file (`.mcp.json` at the repo root, or `.claude/.mcp.json` passed via `claude --mcp-config .claude/.mcp.json`):

  ```json
  {
    "mcpServers": {
      "x402-arc-demo": {
        "type": "http",
        "url": "<mcp-url>/mcp"
      }
    }
  }
  ```

Unlike the stdio setup, there is no local `.env` to keep secrets in: `PRIVY_APP_SECRET` lives only as a Wrangler secret on the mcp Worker, so this config never needs to hold credentials.

### Destroy from Cloudflare Workers

```bash
pnpm --filter facilitator exec wrangler delete
pnpm --filter x402server exec wrangler delete
pnpm --filter x402mcp exec wrangler delete
```