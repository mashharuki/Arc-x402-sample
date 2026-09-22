# Cloudflare Workers デプロイ設計

日付: 2026-09-22 / 対象: `pkgs/facilitator`, `pkgs/server`, `pkgs/mcp`

## 目的

facilitator・x402リソースサーバー・MCPサーバーの3つをCloudflare Workersにデプロイし、リモートで動かせるようにする。既存のNode/ローカル実行手順(`tsx watch`、stdio MCP、`pnpm start`)は壊さず並存させる。

## 決定事項

| 論点 | 決定 |
|------|------|
| MCPのユーザー識別・状態保存 | Durable Object(`McpAgent`)でセッション単位。各参加者がメールOTPでログインする現行フローを維持 |
| 既存Nodeエントリポイント | 並存。Hono appを共通モジュールに切り出し、Node用とWorkers用の両エントリから使う |
| server → facilitator | `FACILITATOR_URL` に公開 `https://…workers.dev` URLを指定(案A)。service bindingは将来の最適化 |
| デプロイ実行 | 準備までを行い、`wrangler deploy` とsecret設定は都度ユーザーが確認して実行 |

## 1. 構成

```
pkgs/facilitator/src/app.ts      # createApp(env) -> Hono (index.tsから切り出し)
pkgs/facilitator/src/index.ts    # Node: dotenv + serve(createApp(process.env))
pkgs/facilitator/src/worker.ts   # Workers: export default { fetch }
pkgs/facilitator/wrangler.jsonc
pkgs/server/   # 同じ構成
pkgs/mcp/      # worker.ts + McpAgent(Durable Object) + wrangler.jsonc
```

- envは引数で受け取る。モジュール先頭の `process.exit` と `privateKeyToAccount` の即時評価はなくし、isolate内で遅延生成してモジュール変数にキャッシュする(appは不変でリクエスト状態を持たないため安全)。
- `wrangler.jsonc`: `compatibility_date` は作成日、`nodejs_compat`、`observability.enabled` と `observability.traces.enabled` を有効化。
- 型は `wrangler types` で生成し、`Env` を手書きしない。

## 2. facilitator / server

**facilitator**
- `EVM_PRIVATE_KEY` はWrangler secret。`RPC_URL` とチェーン値はvars。
- ライフサイクルフックの `console.log` は `context` 全体ではなく必要最小限のフィールドにし、署名等がWorkers Logsに残らないようにする。
- `/settle` はオンチェーン実行のレシート待ちを同期で行うため、Workersの実行時間制限に収まるか、Arcのブロック時間と照らして実装前に確認する。

**server**
- `FACILITATOR_URL`、`ASSET_ADDRESS`、`PAY_TO` はvars(secretではない)。チェーン・価格・`extra` は現行どおり `config.ts` に置く。
- `@x402/avm`、`@x402/svm` が未使用ならWorkers用バンドルから外す。

## 3. リモートMCP

- Streamable HTTPを `/mcp` で公開し、`agents` SDKの `McpAgent` でホストする。セッションごとに1つのDurable Object。
- delegate鍵・Privy認証状態・予算はDurable Objectストレージに保存し、`store.ts` のファイルI/Oを置き換える。
- ツールは現行のまま: `wallet_status`, `wallet_login_start`, `wallet_login_verify`, `set_budget`(`confirm`付き), `pay_and_fetch`(パス許可リスト)。
- `PRIVY_APP_ID` はvar。`PRIVY_APP_SECRET` はWrangler secretで、参加者には渡さない。delegate鍵はどのツールからも返さない。
- `/mcp` は公開エンドポイント。第三者がOTPフローを実行できるが、使えるのは本人のウォレットのみ。ワークショップ用途として許容し、Origin検証とログイン系ツールの簡易レート制限を入れる。

**先に検証するリスク**: `@privy-io/js-sdk-core` と `@privy-io/node` がWorkers上で動くか(ブラウザ/Node APIへの依存)。本実装の前に `wrangler dev` の小さなスパイクで確認する。動かない場合は、実装を変更する前にユーザーへ相談し代替案を決める。

## 4. デプロイと検証

- ルートscripts: `pnpm deploy:facilitator` / `deploy:server` / `deploy:mcp`。READMEに `wrangler secret put` の手順を記載する。
- デプロイ順: facilitator → `FACILITATOR_URL` 設定 → server → mcp。
- 検証(テストスイートがないためE2E確認):
  - ローカルで各Workerを `wrangler dev` し、`curl /supported` と `/health` を確認。
  - デプロイ後、`pnpm x402client run dev` をリモートserverに向けて実行。
  - `claude mcp add --transport http x402-arc-demo https://<mcp>.workers.dev/mcp` で接続し、ツールを実行。
- `wrangler deploy` とsecret設定はユーザー確認のうえで実行する。

## スコープ外

- service bindingによるserver→facilitator接続
- Node側のエントリポイント削除
- チェーン/トークン設定の共通化(CLAUDE.mdに記載の重複問題は別課題)
