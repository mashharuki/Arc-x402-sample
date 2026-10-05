# x402 × Arc ハンズオン：Cloudflare Workersで作る、自然言語で動くAIエージェント決済

## このワークショップで目指すもの

x402のスキームを実現するために必要な3つの要素を**Cloudflare Workers**にデプロイし、手を動かしながらx402のスキームをマスターすることを目指します。

また、**Claude Code**や**Codex**などのAI Agentから自然言語でx402決済を実行するためにMCPサーバーもデプロイします。

最終的に自然言語でx402決済を実行できるようにする状態を目指します！

使うブロックチェーンは **Arc**のテストネットです。

ウォレットには**Privy**を使います。

## このワークショップで得られること

このワークショップの内容を最後まで実践することであなたは以下のことを理解することができます。

- x402スキーム
- Cloudflare Workersにx402スキームに必要なリソースをデプロイする方法
- 任意のチェーン・アセットを設定する方法
  - 今回のワークショップではArcテストネットのUSDCを使いますが、他のチェーンやアセットを設定する方法もコードを見れば理解できるようになっています。
- 自然言語でx402決済を実現させる方法

## 前提条件

- VS Codeなどエディターをインストール済みであること
- Claude CodeのProプラン以上を契約していること
- Git がインストール済みであること
- GitHubアカウントが作成済みであること
- Privyのアカウントを作成済みで、Appを作成し**Emailログインを有効**にしていること
- Cloudflareのアカウントを作成済みであること（無料のWorkers Freeプランで可）
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

まずはローカルで、x402スキームを構成する3つの要素（**client / server / facilitator**）を動かして、決済の流れを確認します。

| 要素 | 役割 | ポート |
|---|---|---|
| facilitator | 支払いの検証（verify）とオンチェーンでの決済（settle）を行う | 4022 |
| server | 有料API（`/weather` など）を提供し、未払いなら402を返す | 4021 |
| client | 402を受け取ると署名して支払い、リトライする | - |

### 1. 環境変数に値を入れる

`pnpm run setup` で作成された`.env`に、以下の値を入れてください。

| ファイル | 変数 | 内容 |
|---|---|---|
| `pkgs/config/.env` | `PAYEE_ADDRESS` | 支払いの受取先アドレス（あなたのウォレットアドレス） |
| `pkgs/facilitator/.env` | `EVM_PRIVATE_KEY` | 決済トランザクションを送るウォレットの秘密鍵（ガス代を払う） |
| `pkgs/client/.env` | `EVM_PRIVATE_KEY` | 支払い側のウォレットの秘密鍵 |

秘密鍵は**MetaMask**からコピーして使います。

1. MetaMaskで、このワークショップ専用の**新しいアカウント**を2つ作成します（例：`x402-client`と`x402-facilitator`）
2. 各アカウントで **︙（アカウントの詳細）→ 秘密鍵を表示** を開き、パスワードを入力して秘密鍵をコピーします
3. clientのアカウントの秘密鍵を`pkgs/client/.env`、facilitatorのアカウントの秘密鍵を`pkgs/facilitator/.env`の`EVM_PRIVATE_KEY`に貼り付けます（`0x`から始まる形式にしてください）
4. `PAYEE_ADDRESS`には、受取用のアドレスを設定します。**clientとは別のアドレス**にしてください（同じだと自分宛ての送金になり、残高の変化で決済を確認できません）。MetaMaskにもう1つアカウントを作って、そのアドレスを使うと分かりやすいです

> ⚠️ 秘密鍵は**テスト専用のウォレット**のものを使ってください。メインのウォレットの秘密鍵は絶対に入れないでください。`.env`はGit管理外ですが、チャットなどにも貼らないでください。

チェーンやトークン、価格は`pkgs/config/.env`にまとまっています（デフォルトは**Arc Testnet**のUSDC）。このファイルを書き換えるだけで、他のチェーンやアセットに切り替えられます。

### 2. テストネットUSDCを入手する

[Circle Faucet](https://faucet.circle.com/)で**Arc Testnet**を選び、USDCを受け取ります。

- client（支払い側）のアドレス：最低でも**2 USDC**
- facilitatorのアドレス：ガス代として少額

> ArcではUSDCがガストークンを兼ねているため、別途ガストークンを用意する必要はありません。

### 3. facilitatorとserverを起動する

ターミナルを2つ開き、**facilitator → server**の順に起動します。

```bash
# ターミナルA
pnpm facilitator run dev
```

```bash
# ターミナルB
pnpm x402server run dev
```

もしくは、以下のコマンドで2つまとめてバックグラウンドで起動できます（ログは`.run/`に出力されます）。

```bash
pnpm start
```

止めるときは`pnpm stop`です。

## 動作確認（ローカル）

### 1. 起動確認

```bash
curl localhost:4022/supported
curl localhost:4021/health
```

`/supported`で、facilitatorが対応している決済方式（`exact`と`upto`）とネットワーク（`eip155:5042002`）が返ってくればOKです。

### 2. 支払い前の状態（HTTP 402）を確認する

支払い情報を付けずに有料APIを叩いてみます。

```bash
curl -i localhost:4021/weather
```

`HTTP/1.1 402 Payment Required`が返り、`PAYMENT-REQUIRED`ヘッダーに**価格・受取先・チェーン**などの支払い要件がBase64で入っています。clientはこの内容を読んで、その場で支払い方法を知ります。

### 3. clientで支払ってデータを取得する

```bash
pnpm x402client run dev
```

clientが402を受け取り → 署名 → 支払い付きでリトライ → データ取得、という流れを自動で行います。天気データと`Payment settled`（`success: true`とトランザクションハッシュ）が表示されれば成功です🎉

トランザクションは[Arc Testnet Explorer](https://explorer.testnet.arc.io/)で確認できます。

### 4. 使った分だけ払う`upto`スキームを試す

`/usage?units=N`は、使ったユニット数に応じた金額だけを決済する**`upto`（従量課金）**のAPIです。clientは「最大でいくらまで」を署名で認可し、serverが実際の利用量分だけを決済します。

まず、clientの支払い予算（USDCのPermit2へのallowance）を設定します。`--execute`を付けないと現在の値を確認するだけのdry-runになります。

```bash
pnpm x402client run approve 2000000 --execute
```

次に、ガードレールのシナリオを実行します（facilitatorとserverが起動している必要があります）。

```bash
pnpm x402client run guardrails
```

以下の3つのケースが`PASS`になれば成功です。

- 署名した上限の範囲内（0.3 USDC）は決済される
- 署名した上限（0.5 USDC）を超える決済（1.0 USDC）は拒否される
- clientの上限（`MAX_AMOUNT_PER_PAYMENT`）を超える場合は、署名する前に拒否される

AIエージェントにお金を扱わせる場合に重要な「支払いの上限を何重にもかける」考え方を、ここで体験できます。

## Cloudflare Workersにデプロイ

ここまでローカルで動かした3つの要素を、**Cloudflare Workers**にデプロイします。あわせて、AI Agentから自然言語で決済するための**MCPサーバー**もデプロイします。

### 1. Cloudflareにログインする

```bash
pnpm --filter facilitator exec wrangler login
pnpm --filter facilitator exec wrangler whoami
```

デプロイ先のアカウントが正しいか確認してください。また、[Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)で`workers.dev`のサブドメインが未設定の場合は先に設定しておきます。

### 2. Privyの設定をする

MCPサーバーでウォレットを作るために、[Privy Dashboard](https://dashboard.privy.io)で以下を行います。

1. **Email**ログインを有効にする
2. **App ID**・**App Secret**・**Client ID**を控える
   - `PRIVY_APP_ID`と`PRIVY_CLIENT_ID`は公開してよい値なので`pkgs/mcp/wrangler.jsonc`の`vars`に、`PRIVY_APP_SECRET`は上のsecretに設定します
3. **Allowed origins**に、デプロイ後のmcp Workerのオリジン（例：`https://x402-arc-mcp.<あなたのサブドメイン>.workers.dev`）を追加する
   - mcp WorkerのURLは、デプロイ前でも「Worker名（`x402-arc-mcp`）＋あなたの`workers.dev`サブドメイン」で決まります
   - サブドメインは、[Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)のダッシュボードで確認できます。`pnpm --filter facilitator exec wrangler whoami`でもアカウントの情報を確認できます
   - ローカルで試す場合は`http://localhost:5173`も追加しておきます

### 3. シークレットを登録する

秘密鍵などの秘密情報は、ファイルではなく**wranglerのsecret**として登録します。コマンド実行後に値の入力を求められるので、ご自身で入力してください。

```bash
pnpm --filter facilitator exec wrangler secret put EVM_PRIVATE_KEY
pnpm --filter x402mcp exec wrangler secret put PRIVY_APP_SECRET
```

> ⚠️ `PRIVY_APP_SECRET`はそのアプリの全ユーザーのウォレットを作成できる強い権限を持ちます。他人に渡したり、Gitにコミットしたりしないでください。

初回の`wrangler secret put`では、まだWorkerが存在しないため作成するか聞かれることがあります。その場合は`Y`で進めてください。

### 4. デプロイする（順番が大事です）

3つのWorkerは互いのURLを参照するため、**facilitator → server → mcp**の順にデプロイします。

**① facilitator**

```bash
pnpm deploy:facilitator
```

出力された`https://x402-arc-facilitator.<サブドメイン>.workers.dev`のURLを控えます。

**② server**

`pkgs/server/wrangler.jsonc`の`FACILITATOR_URL`を、①のURLに書き換えてからデプロイします。

```jsonc
"vars": {
  "FACILITATOR_URL": "https://x402-arc-facilitator.<サブドメイン>.workers.dev"
}
```

```bash
pnpm deploy:server
```

**③ mcp**

`pkgs/mcp/wrangler.jsonc`の以下の値を書き換えてからデプロイします。

```jsonc
"vars": {
  "PAYWALL_API_BASE_URL": "https://x402-arc-server.<サブドメイン>.workers.dev", // ②のURL
  "PRIVY_APP_ID": "<あなたのApp ID>",
  "PRIVY_CLIENT_ID": "<あなたのClient ID>",
  "PRIVY_ORIGIN": "https://x402-arc-mcp.<サブドメイン>.workers.dev" // このmcp WorkerのURL
}
```

```bash
pnpm deploy:mcp
```

> 💡 必ず`pnpm deploy:*`を使ってください。`wrangler deploy`を直接実行すると、`pkgs/config/.env`の共有設定（チェーン・トークン・価格など）がWorkerに渡らず、Workerが500エラーを返します。

## 動作確認（デプロイ後）

### 1. facilitatorとserverの確認

```bash
curl -s https://<facilitatorのURL>/supported
curl -s https://<serverのURL>/health
curl -s -i https://<serverのURL>/weather
```

ローカルのときと同じように、`/supported`が返り、`/weather`が`402`になればデプロイ成功です。

### 2. MCPサーバーをClaude Codeに登録する

```bash
claude mcp add --transport http x402-arc-remote https://<mcpのURL>/mcp
```

登録後、Claude Codeで`/mcp`を実行して接続状態を確認してください。

### 3. 自然言語でx402決済を実行する

MCPサーバーには以下のツールがあります。

| ツール | 内容 |
|---|---|
| `wallet_status` | ウォレットの有無・残高・allowanceの確認 |
| `wallet_login_start` / `wallet_login_verify` | メールのワンタイムコードでログインし、Privyのウォレットを作成 |
| `set_budget` | 支払い予算（allowance）の設定。**金額の確認（confirm）を挟む2ステップ** |
| `pay_and_fetch` | 有料APIにアクセスして支払う（`/weather`と`/usage?units=N`のみ許可） |

Claude Codeに、以下のように話しかけてみましょう。

> ウォレットの状態を確認して。まだ無ければ、メールでログインしてウォレットを作るところまで案内して。

ウォレットが作られたら、表示されたアドレスに[Circle Faucet](https://faucet.circle.com/)で**Arc Testnet**のUSDCを入金し、続けて以下を依頼します。

> 予算を2 USDCに設定して（金額は私に確認してから実行して）。そのあと以下を順番にやって、それぞれ結果を教えて。
> 1. `/weather`を支払って取得（exact、0.5 USDC）
> 2. `/usage?units=3`を支払って取得（upto、0.3 USDC）
> 3. `/usage?units=10`を支払って取得（uptoで1.0 USDC。署名した上限0.5 USDCを超えるのでどうなる？）

期待される結果は以下の通りです。

- 1と2：決済が成功する
- 3：facilitatorが`invalid_upto_evm_payload_settlement_exceeds_amount`で拒否し、**課金されない**

> 💡 予算の承認（`set_budget`）だけは人間が確認する設計です。AIエージェントが自分で支払い上限を引き上げることはできません。一度予算を承認すれば、あとは上限の範囲内でエージェントが自律的に支払えます。これが「AIエージェントに安全にお金を扱わせる」ための仕組みです。

### うまくいかないとき

| 症状 | 確認すること |
|---|---|
| `wallet_login_start`が`Origin not allowed`で失敗 | Privy Dashboardの**Allowed origins**にmcp WorkerのURLを登録したか |
| `wallet_login_start`が`Must specify origin`で失敗 | `PRIVY_ORIGIN`を設定してmcpを再デプロイしたか |
| Workerが変数名つきの500エラーを返す | `wrangler deploy`を直接実行していないか（`pnpm deploy:*`を使う） |
| serverからfacilitatorへのリクエストが失敗する（Cloudflareエラー1042） | `wrangler.jsonc`の`compatibility_flags`に`global_fetch_strictly_public`があるか |
| `wallet_status`で`rate limit exceeded` | ArcのパブリックRPCの制限です。数秒待って再実行してください |
| `invalid_exact_evm_insufficient_balance` | 支払い側ウォレットのUSDC残高が不足しています。Faucetで補充してください |

ログは以下で確認できます。

```bash
pnpm --filter <パッケージ名> exec wrangler tail
```

## 後片付け

検証が終わったら忘れずに以下のコマンドを実行してデプロイしたリソースを削除してください。

```bash
pnpm --filter facilitator exec wrangler delete
pnpm --filter x402server exec wrangler delete
pnpm --filter x402mcp exec wrangler delete
```

正常に処理が完了すれば全てのリソースが**Cloudflare Workers**から削除されます。

## まとめ

以上でワークショップは終わりです！

おめでとうございます🥳！！

これでx402スキームを実現するための最小限のソースコードをCloudflare Workersにデプロイして動かす方法を学びました。

次はこのコードをベースにあなただけのオリジナルなアプリの開発に繋げてください！！

このワークショップを受講していただき本当にありがとうございました！！

Haruki

## 参考リンク

- [このワークショップのリポジトリ](https://github.com/mashharuki/Arc-x402-sample)
- [x402 公式サイト](https://www.x402.org/)
- [x402 ドキュメント](https://docs.x402.org/)
- [Arc（Circle）](https://docs.arc.io/arc-chain)
- [Circle Faucet](https://faucet.circle.com/)
- [Arc Testnet Explorer](https://explorer.testnet.arc.io/)
- [Privy Dashboard](https://dashboard.privy.io)
- [Cloudflare Workers ドキュメント](https://developers.cloudflare.com/workers/)
- [Cloudflare Workers デプロイ手順（詳細版）](./cloudflare-deploy.md)
