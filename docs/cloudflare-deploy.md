# Cloudflare Workers デプロイ手順

facilitator / server / mcp(リモートMCP)を Cloudflare Workers で動かす手順です。

## 1. 前提

- Cloudflare アカウントと `pnpm exec wrangler login`
- レシート待ちは I/O であり Workers の CPU 時間を消費しません。Free プランの CPU 上限(10 ms)で問題になり得るのは署名・EIP-712 検証などの計算(`/verify` と `/settle`)です。最初の実 E2E では待ち時間ではなくこれらの CPU 時間を計測してください。CPU time exceeded が出たら Workers Paid が必要です
- `compatibility_date` は全 `wrangler.jsonc` で `2026-09-21` です。インストール済みの workerd が受け付ける最新日付で、未来日付は拒否されます。wrangler を更新したら日付も更新してください

## 2. ローカル開発

各パッケージ(facilitator / server / mcp)で `cp .dev.vars.example .dev.vars` を実行してください(ローカル開発と `cf:typecheck` の両方に必要です。`wrangler types` が `.dev.vars` を読むため)。`.example` はダミー値で、本物の値は `vars` または `wrangler secret put` で設定します。`.dev.vars` は git 管理外です。

`.dev.vars` にダミー値を置けば、`/health` `/supported` と MCP の `wallet_status` は動きます。

| コマンド | ポート |
|---|---|
| `pnpm cf:dev:facilitator` | 8788 |
| `pnpm cf:dev:server` | 8789 |
| `pnpm cf:dev:mcp` | 8790(MCPは `/mcp`) |

## 3. デプロイ前チェックリスト

`vars` は意図的に不完全です。公開してよい(秘密でない)値を、各 `.env` からコピーして追加してください。

- [ ] `pkgs/server/wrangler.jsonc` の `vars` に `ASSET_ADDRESS` と `EVM_ADDRESS`(`pkgs/server/.env` と同じ値)
- [ ] `pkgs/mcp/wrangler.jsonc` の `vars` に `PRIVY_APP_ID` `PRIVY_CLIENT_ID` `ASSET_ADDRESS` `ALLOWED_PAYEES`(`pkgs/mcp/.env` と同じ値。`ALLOWED_PAYEES` は server の `EVM_ADDRESS`)
- [ ] **必須** mcp の `PRIVY_ORIGIN`: 既定の `http://localhost:5173` のままだと、デプロイ済み Worker から privy.io へ `Origin: http://localhost:5173` が送られます。デプロイ済み mcp Worker の https オリジン(または別のオリジン)を設定し、そのオリジンを Privy Dashboard の Allowed origins に登録してください。localhost のままでも動くのは、localhost:5173 が Allowed origins に残っている間だけです

```jsonc
// pkgs/server/wrangler.jsonc
"vars": {
  "FACILITATOR_URL": "<facilitator の URL>",
  "ASSET_ADDRESS": "0x...",
  "EVM_ADDRESS": "0x..."
}

// pkgs/mcp/wrangler.jsonc
"vars": {
  "PAYWALL_API_BASE_URL": "<server の URL>",
  "PRIVY_APP_ID": "...",
  "PRIVY_CLIENT_ID": "...",
  "ASSET_ADDRESS": "0x...",
  "ALLOWED_PAYEES": "0x..."
}
```

ファイルを編集せずに渡す場合: `pnpm --filter x402server exec wrangler deploy --var ASSET_ADDRESS:0x... --var EVM_ADDRESS:0x...`(mcp も同様)。

### Secrets(ファイルに書かない)

値はご自身で入力してください。

```bash
pnpm --filter facilitator exec wrangler secret put EVM_PRIVATE_KEY
pnpm --filter x402mcp exec wrangler secret put PRIVY_APP_SECRET
```

`PRIVY_APP_SECRET` は参加者に渡さないこと。任意設定: facilitator の `RPC_URL`、mcp の `ALLOWED_ORIGINS`(ブラウザからの Origin 許可リスト)。

## 4. デプロイ順

1. `pnpm deploy:facilitator` → 出力された URL を控える
2. `pkgs/server/wrangler.jsonc` の `FACILITATOR_URL` を facilitator の URL に更新 → `pnpm deploy:server`
3. `pkgs/mcp/wrangler.jsonc` の `PAYWALL_API_BASE_URL` を server の URL に更新 → `pnpm deploy:mcp`

(`pnpm deploy` は pnpm 組み込みコマンドのため、ルートのスクリプト名は `deploy:*` にしています。)

## 5. 動作確認

```bash
curl -s <facilitator-url>/supported
curl -s <server-url>/health
curl -s -i <server-url>/weather        # 402 が返る
claude mcp add --transport http x402-arc-remote <mcp-url>/mcp
```

リモートで `wallet_login_start` が成功することを必ず確認してください。workerd が送信サブリクエストで呼び出し側が設定した `Origin` ヘッダを転送するかは未検証です。除去される場合、ログインは "Must specify origin" で失敗します。

ログ: `pnpm --filter <pkg> exec wrangler tail`

## 6. 運用上の注意(Operational caveats)

1. **`/mcp` は認証なしの公開エンドポイント**です。Origin チェックはブラウザしか防げず、誰でもセッションを開始してメール OTP フローを起動できます。レート制限は 30 リクエスト/60 秒/クライアントIP ですが、Cloudflare のロケーション単位であり、IP を変えれば回避できます。任意の強化策として、ワークショップ前に共有 Bearer トークンや OTP 専用の制限の追加を検討してください。
2. **レート制限は全リクエストを数えます**(SSE の GET も各 JSON-RPC の POST も)。会場の NAT 配下に参加者が多いと1つのバケットを共有し、誤って 429 になることがあります。必要なら `pkgs/mcp/wrangler.jsonc` の `simple.limit` を上げてください。また `ratelimits.namespace_id`(`"4021"`)は Cloudflare アカウント内で一意にしてください。
3. **ウォレット状態(委任キー)は1つの MCP セッションの Durable Object に保存**されます。クライアントがセッションを失う・切り替わると委任キーが失われ、再度ログインして新しいウォレットを作ることになります。旧ウォレットはユーザー所有のため Privy 側に残りますが、この委任キーでは操作できません。取り残されても許容できる額以上を入金しないでください。

## 7. 未検証事項

- Free プランでの `/verify` と `/settle` の CPU 時間(Workers Paid が必要な可能性)
- 送信サブリクエストで `Origin` ヘッダが転送されるか(`wallet_login_start`)
- Privy が WebCrypto で生成した委任キーを受け付けるか
- Privy の実ログイン・ウォレット作成・ポリシー適用の一連の流れ

これらは最初の実デプロイでのテストまで確認できていません。
