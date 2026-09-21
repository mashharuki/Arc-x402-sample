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