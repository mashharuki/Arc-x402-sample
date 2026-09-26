# Cloudflare Workers デプロイ手順

facilitator / server / mcp(リモートMCP)を Cloudflare Workers で動かす手順です。

## 1. 前提

- Cloudflare アカウントと `pnpm exec wrangler login`
- レシート待ちは I/O であり Workers の CPU 時間を消費しません。Free プランの CPU 上限(10 ms)で問題になり得るのは署名・EIP-712 検証などの計算(`/verify` と `/settle`)です。2026-09-22 の実デプロイでは `exact`(0.5 USDC)と `upto`(0.3 USDC、および上限超過で拒否される 1.0 USDC 要求)の決済がいずれも CPU time exceeded なく完走しました。ただし1リクエストずつの軽い負荷での確認であり、高頻度アクセス時の余裕までは検証していません
- `compatibility_date` は全 `wrangler.jsonc` で `2026-09-21` です。インストール済みの workerd が受け付ける最新日付で、未来日付は拒否されます。wrangler を更新したら日付も更新してください
- `pkgs/server/wrangler.jsonc` と `pkgs/mcp/wrangler.jsonc` の `compatibility_flags` には `global_fetch_strictly_public` が**必須**です。server は facilitator を、mcp は server を `fetch()` で呼びますが、両方とも同じアカウントの `workers.dev` ゾーンに属するため、このフラグがないと Cloudflare エラー 1042(“Worker tried to fetch from another Worker on the same zone”)で全リクエストが失敗します([Cloudflare Docs: compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/#global-fetch-strictly-public))

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

- [ ] `pkgs/server/wrangler.jsonc` の `vars` に `EVM_ADDRESS`(`pkgs/server/.env` と同じ値)
- [ ] `pkgs/mcp/wrangler.jsonc` の `vars` に `PRIVY_APP_ID` `PRIVY_CLIENT_ID` `ALLOWED_PAYEES`(`pkgs/mcp/.env` と同じ値。`ALLOWED_PAYEES` は server の `EVM_ADDRESS`)
- [ ] **必須** mcp の `PRIVY_ORIGIN`: 既定の `http://localhost:5173` のままだと、デプロイ済み Worker から privy.io へ `Origin: http://localhost:5173` が送られます。デプロイ済み mcp Worker の https オリジン(または別のオリジン)を設定し、そのオリジンを Privy Dashboard の Allowed origins に登録してください。localhost のままでも動くのは、localhost:5173 が Allowed origins に残っている間だけです

```jsonc
// pkgs/server/wrangler.jsonc
"vars": {
  "FACILITATOR_URL": "<facilitator の URL>",
  "EVM_ADDRESS": "0x..."
}

// pkgs/mcp/wrangler.jsonc
"vars": {
  "PAYWALL_API_BASE_URL": "<server の URL>",
  "PRIVY_APP_ID": "...",
  "PRIVY_CLIENT_ID": "...",
  "ALLOWED_PAYEES": "0x..."
}
```

チェーン・トークン・価格は `vars` ではなく `pkgs/config/src/index.ts` にあり、Worker のビルドに含まれます。変更したら server / facilitator / mcp を再デプロイしてください。

ファイルを編集せずに渡す場合: `pnpm --filter x402server exec wrangler deploy --var EVM_ADDRESS:0x...`(mcp も同様)。

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

リモートで `wallet_login_start` が成功することを必ず確認してください。2026-09-22 の実デプロイで、Privy Dashboard の Allowed origins にデプロイ済み mcp Worker の URL を登録した上で成功することを確認済みです(workerd は送信サブリクエストで呼び出し側が設定した `Origin` ヘッダを転送します)。Allowed origins への登録を忘れると `Origin not allowed` で、`PRIVY_ORIGIN` 自体が未設定/不一致だと `Must specify origin` で失敗します。

ログ: `pnpm --filter <pkg> exec wrangler tail`

## 6. 運用上の注意(Operational caveats)

1. **`/mcp` は認証なしの公開エンドポイント**です。Origin チェックはブラウザしか防げず、誰でもセッションを開始してメール OTP フローを起動できます。レート制限は既定 300 リクエスト/60 秒/クライアントIP ですが、Cloudflare のロケーション単位であり、IP を変えれば回避できます。任意の強化策として、ワークショップ前に共有 Bearer トークンや OTP 専用の制限の追加を検討してください。
2. **レート制限は全リクエストを数えます**(SSE の GET も各 JSON-RPC の POST も)。会場の Wi-Fi/NAT 配下に参加者が多いと、Cloudflare には全員が同じ送信元IPに見え、1つのバケットを共有して誤って 429 になることがあります。目安として、[README の「Try every tool in one prompt」](../README.md#try-every-tool-in-one-prompt)の一連の操作(login → verify → set_budget ×2 → pay_and_fetch ×3)で1人あたり概ね10〜15リクエストです。`pkgs/mcp/wrangler.jsonc` の `simple.limit`(既定 300)を「想定参加者数 × 15」程度を目安に事前に引き上げてください(例: 50人なら 750 以上)。`period` は Cloudflare の仕様上 10 か 60 秒のみです。また `ratelimits.namespace_id`(`"4021"`)は Cloudflare アカウント内で一意にしてください。
3. **ウォレット状態(委任キー)は1つの MCP セッションの Durable Object に保存**されます。クライアントがセッションを失う・切り替わると委任キーが失われ、再度ログインして新しいウォレットを作ることになります。旧ウォレットはユーザー所有のため Privy 側に残りますが、この委任キーでは操作できません。取り残されても許容できる額以上を入金しないでください。
4. **Bazaar discovery 拡張のスキーマ検証は Workers では動きません**(直さない判断)。`/weather` へのリクエスト時に `(warn) x402: Route "GET /weather" has an invalid bazaar extension: Schema validation failed: Code generation from strings disallowed for this context` がログに出ます。`@x402/extensions` 内部が `new Ajv({...}).compile(schema)` で検証関数を実行時コード生成(`new Function`)するためで、Workers はこれを許可しません。回避オプションは ajv 側にも `@x402/extensions`(2.26.0 でも同じ ajv 系列)側にも用意されておらず、直すには依存パッケージへのパッチかアップストリームの対応が必要です。
   - **影響範囲は Bazaar レジストリ向けのメタデータ検証だけ**です。決済フロー自体(402 応答・`/verify`・`/settle`)には一切影響せず、失敗は握りつぶされて warning ログになるだけです
   - **ローカル(Node)では問題なく動きます**。`new Function` が制限されるのは Workers 上だけです
   - ワークショップの説明では、"discovers" を Bazaar のようなレジストリ型 discovery ではなく、**402 レスポンスの `accepts[]` から事前登録なしにその場で価格・条件を発見する、プロトコルネイティブな discovery** という意味で使ってください。これは Workers 上でも完全に機能し、誇張になりません

## 7. 検証済み事項

2026-09-22 の実デプロイで、以下をすべて実際の決済・実メールでのログインまで通して確認できました:

- facilitator: `/health`、`/supported`(`exact` / `upto` を `eip155:5042002` で提供)
- server: `/health`、`/weather`(402)、`/usage?units=1`(402)。facilitator への `fetch()` は `global_fetch_strictly_public` 適用後に成功
- mcp: リモート Streamable HTTP セッション全体(`initialize` → `notifications/initialized` → `tools/list` → 各ツールの `tools/call`)が動作
- **Privy の実ログイン・ウォレット作成・ポリシー適用の一連の流れ**: 実メールで OTP を送信 → コード検証 → user-owned ウォレット作成まで成功(新規ウォレット `0x39F83d...0A738`)
- **Privy が WebCrypto で生成した委任キーを受け付けること**: 上記のウォレット作成で使われた委任キーは Workers 上の WebCrypto(`crypto.subtle.generateKey`)で生成されたもの
- **workerd が送信サブリクエストで `Origin` ヘッダを転送すること**: `PRIVY_ORIGIN` を mcp Worker の URL に設定し、その URL を Privy Dashboard の Allowed origins に登録した状態で `wallet_login_start` が成功(未登録の間は `Origin not allowed` で失敗した)
- **`/verify` と `/settle` が実決済で正常動作すること**: `exact`(`/weather`, 0.5 USDC)と `upto`(`/usage?units=3`, 0.3 USDC)がいずれも settled、`/usage?units=10`(1.0 USDC 要求、署名上限 0.5 USDC 超過)は `invalid_upto_evm_payload_settlement_exceeds_amount` で想定通り拒否(`transaction` は空文字列でオンチェーン実行なし)。いずれも CPU time exceeded は発生せず

残る注意点(未検証というより、確認していない範囲):

- 上記はいずれも1リクエストずつの軽い負荷での確認です。高頻度アクセス時に Free プランの CPU 上限に達するかは未確認です
- MCP セッションが切れた場合の再ログイン・新規ウォレット作成の挙動(6章3点目の制約)は設計通り想定されていますが、実際に再現テストはしていません
