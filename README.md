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
