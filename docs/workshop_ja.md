# ワークショップ手順

## このワークショップで目指すもの

x402のスキームを実現するために必要な3つの要素を**Cloudflare Workers**にデプロイし、手を動かしながらx402のスキームをマスターすることを目指します。

また、**Claude Code**や**Codex**などのAI Agentから自然言語でx402決済を実行するためにMCPサーバーもデプロイします。

最終的に自然言語でx402決済を実行できるようにする状態を目指します！

使うブロックチェーンは **Arc**のテストネットです。

ウォレットには***Privy*を使います。

## このワークショップで得られること

このワークショップの内容を最後まで実践することであなたは以下のことを理解することができます。

- x402スキーム
- CloudFlare Workersにx402スキームに必要なリソースをデプロイする方法
- 任意のチェーン・アセットを設定する方法
- 自然言語でx402決済を実現させる方法

## 前提条件

- VS Codeなどエディターをインストール済みであること
- Claude CodeのProプラン以上を契約していること
- Git がインストール済みであること
- GitHubアカウントが作成済みであること
- Privyのアカウントを作成済みであること
- Nodejsおよびpnpmをインストール済みであること
- wrangler CLIをインストール済みであること

## セットアップ

### 依存関係のインストール

プロジェクトのルートで以下を実行します。

```bash
pnpm install
```

### 環境変数の設定

まず環境変数用のファイルのテンプレートを全て複製します。

```bash
pnpm run setup
```

このコマンドにより、以下の8つの環境変数用のファイルが作成されます。

```bash
pkgs/client/.env
pkgs/server/.env
pkgs/server/.dev.vars
pkgs/facilitator/.env
pkgs/facilitator/.dev.vars
pkgs/mcp/.env
pkgs/mcp/.dev.vars
pkgs/config/.env
```

### 設定がうまく適用されているかどうかチェックする

ビルドできるかどうか確認します。

```bash
pnpm run -r build
```

全てのモジュールが正常にビルドされれば準備OKです！

## ローカルでの確認手順

## 動作確認

## CloudFlare Workersにデプロイ

## 動作確認

## 後片付け

検証が終わったら忘れずに以下のコマンドを実行してデプロイしたリソースを削除してください。

```bash
pnpm --filter facilitator exec wrangler delete
pnpm --filter x402server exec wrangler delete
pnpm --filter x402mcp exec wrangler delete
```

正常に処理が完了すれば全てのリソースが**Cloudflare Workers**から削除されます。

## まとめ