# Cloudflare Workers デプロイ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** facilitator・x402リソースサーバー・MCPサーバーをCloudflare Workersにデプロイできるようにし、既存のNode/stdio実行も壊さず並存させる。

**Architecture:** 各パッケージでHono app / MCPツール定義を「envを引数に取る共通モジュール」に切り出し、Node用エントリ(既存)とWorkers用エントリ(`worker.ts`)の両方から使う。MCPは `agents` SDKの `McpAgent`(Durable Object)でStreamable HTTPを `/mcp` に公開し、ウォレット状態をDOストレージに保存する。

**Tech Stack:** Cloudflare Workers / Wrangler, Hono, `agents` (McpAgent), `@modelcontextprotocol/sdk`, viem, `@x402/*` ^2.23.0, Privy, pnpm workspace, Biome。

**Spec:** `docs/superpowers/specs/2026-09-22-cloudflare-workers-deploy-design.md`

## Global Constraints

- 既存のNodeエントリポイント(`tsx watch` / stdio MCP / `pnpm start`)は並存させ、動作を壊さない(仕様: 並存)
- `compatibility_date` は `2026-09-22`、`compatibility_flags` は `["nodejs_compat"]`
- `observability.enabled` と `observability.traces.enabled` を両方 `true`
- `Env` 型は `wrangler types` で生成し手書きしない(生成物 `worker-configuration.d.ts` は `.gitignore`)
- 秘密情報(`EVM_PRIVATE_KEY`, `PRIVY_APP_SECRET`)は Wrangler secret のみ。リポジトリ・`wrangler.jsonc`・ログに出さない
- ライフサイクルフックのログに `context` 全体を出さない(署名等がWorkers Logsに残るため)
- delegate鍵はどのMCPツールの戻り値にも含めない
- server → facilitator は `FACILITATOR_URL` に公開URLを指定(service bindingは対象外)
- `wrangler deploy` と `wrangler secret put` は実行前にユーザーの確認を取る
- ソースコメントは日本語。ルートのエラー応答は `c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500)`
- コミットはConventional Commits。`git add` は自分が触ったパスを明示列挙する(`git add -A` 禁止)。`main` へ直接pushしない
- コミットメッセージ末尾: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- 検証はテストスイートがないため、型チェック・`curl`・`wrangler dev` によるE2E確認で行う

## File Structure

```
.gitignore                                  # Modify: .dev.vars / .wrangler / worker-configuration.d.ts
package.json                                # Modify: deploy:* / cf:dev:* scripts
pkgs/facilitator/
  src/viem.ts                               # Modify: 関数化(env非依存)
  src/facilitator.ts                        # Create: createFacilitator(env)
  src/app.ts                                # Create: createApp(facilitator) (index.tsから移動)
  src/index.ts                              # Modify: Nodeエントリ(薄く)
  src/worker.ts                             # Create: Workersエントリ
  wrangler.jsonc, tsconfig.worker.json      # Create
pkgs/server/
  src/config.ts                             # Modify: createX402Config(env)
  src/facilitator.ts                        # Modify: createFacilitatorClient(url)
  src/resourceServer.ts                     # Modify: createResourceServer(url)
  src/app.ts                                # Create: createApp(env) (index.tsから移動)
  src/index.ts                              # Modify: Nodeエントリ(薄く)
  src/worker.ts                             # Create
  wrangler.jsonc, tsconfig.worker.json      # Create
pkgs/mcp/
  src/env.ts                                # Modify: parseEnv(raw) (dotenv/process.env依存を除去)
  src/store.ts                              # Modify: WalletStore型 + createFileStore + createKvStore
  src/privy.ts                              # Modify: delegate鍵生成をWebCryptoへ
  src/tools.ts                              # Create: createMcpServer / registerTools
  src/index.ts                              # Modify: stdioエントリ(薄く)
  src/guard.ts                              # Create: Origin検証 + レート制限
  src/worker.ts                             # Create: McpAgent + Workersエントリ
  wrangler.jsonc, tsconfig.worker.json      # Create
docs/cloudflare-deploy.md                   # Create: デプロイ手順
CLAUDE.md                                   # Modify: Workers節を追記
```

---

### Task 0: ブランチ作成と共通準備

**Files:**
- Modify: `.gitignore`

**Interfaces:**
- Produces: 作業ブランチ `feat/cloudflare-workers-deploy`

- [ ] **Step 1: ブランチを切る**

```bash
git -C /Users/harukikondo/git/Arc-x402-sample switch -c feat/cloudflare-workers-deploy
```

- [ ] **Step 2: `.gitignore` にWorkers関連を追記**

ルート `.gitignore` の末尾に追加(既にあれば重複させない。`grep -n "dev.vars" .gitignore` で確認):

```
# Cloudflare Workers
.dev.vars
.wrangler/
worker-configuration.d.ts
```

- [ ] **Step 3: コミット**

```bash
git add .gitignore
git commit -m "chore: ignore Cloudflare Workers local files" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 1: スパイク — Privy SDKがWorkersで動くか(go/no-go)

`pkgs/mcp` の本実装より前に、`@privy-io/js-sdk-core` と `@privy-io/node` がWorkersランタイムでロード・インスタンス化できるかを確認する。**使い捨て**で、最後に削除する。

**Files:**
- Create (throwaway): `pkgs/mcp/spike/wrangler.jsonc`, `pkgs/mcp/spike/worker.ts`
- Modify: `pkgs/mcp/package.json`(`wrangler` を devDependency に追加 — これは残す)

**Interfaces:**
- Produces: go/no-go の結論。**no-goならここで止まり、ユーザーに報告して代替案を相談する(Task 5以降に進まない)**

- [ ] **Step 1: wranglerを追加**

```bash
pnpm --filter x402mcp add -D wrangler
pnpm --filter x402mcp add agents
```

`agents` と `@modelcontextprotocol/sdk` のpeer dependency警告が出たら内容を記録する。

- [ ] **Step 2: スパイク用Workerを書く**

`pkgs/mcp/spike/wrangler.jsonc`:

```jsonc
{
  "name": "x402-mcp-spike",
  "main": "worker.ts",
  "compatibility_date": "2026-09-22",
  "compatibility_flags": ["nodejs_compat"]
}
```

`pkgs/mcp/spike/worker.ts`:

```ts
import Privy from "@privy-io/js-sdk-core";
import { PrivyClient } from "@privy-io/node";
import { createViemAccount } from "@privy-io/node/viem";

class MemoryStorage {
  private readonly map = new Map<string, unknown>();
  get(key: string): unknown {
    return this.map.get(key);
  }
  put(key: string, value: unknown): void {
    this.map.set(key, value);
  }
  del(key: string): void {
    this.map.delete(key);
  }
  getKeys(): string[] {
    return [...this.map.keys()];
  }
}

export default {
  async fetch(): Promise<Response> {
    const results: Record<string, string> = {};

    try {
      const node = new PrivyClient({ appId: "dummy", appSecret: "dummy" });
      results.privyNode = typeof node.wallets === "function" ? "ok" : "no wallets()";
      results.createViemAccount = typeof createViemAccount;
    } catch (error) {
      results.privyNode = `FAIL: ${error instanceof Error ? error.message : String(error)}`;
    }

    try {
      const auth = new Privy({
        appId: "dummy",
        clientId: "dummy",
        storage: new MemoryStorage(),
      });
      results.jsSdkCore = "constructed";
      // ダミー認証情報なのでAPIエラーになるのが正常。「ランタイムエラーで落ちない」ことを確認する
      await auth.auth.email.sendCode("spike@example.com");
      results.sendCode = "unexpected success";
    } catch (error) {
      results.sendCode = `api-error(expected): ${error instanceof Error ? error.message : String(error)}`;
    }

    try {
      const pair = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"],
      );
      const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
      results.webCrypto = `ok spki=${spki.byteLength}B`;
    } catch (error) {
      results.webCrypto = `FAIL: ${error instanceof Error ? error.message : String(error)}`;
    }

    return Response.json(results);
  },
};
```

- [ ] **Step 3: 起動して確認**

```bash
cd /Users/harukikondo/git/Arc-x402-sample/pkgs/mcp
pnpm exec wrangler dev --config spike/wrangler.jsonc --port 8790 &
sleep 8
curl -s localhost:8790 | tee /dev/stderr
kill %1
```

Expected(go): バンドルとロードが成功し、次のようなJSONが返る。
- `privyNode: "ok"`、`jsSdkCore: "constructed"`
- `sendCode` は `api-error(expected): ...`(ネットワーク/API由来のエラー。`window is not defined` や `is not a function` などのランタイム由来なら **no-go**)
- `webCrypto: "ok spki=91B"`

wranglerのバンドル時にモジュール解決エラー(`Could not resolve "..."`)が出た場合も **no-go**。エラー全文を記録する。

- [ ] **Step 4: 結論をユーザーに報告**

go → 次へ。no-go → 失敗内容を報告して停止(Privy呼び出しを別Workerに分離する、PrivyのREST APIを直接叩く等の代替をユーザーと相談)。

- [ ] **Step 5: スパイクを削除し、依存追加だけコミット**

```bash
cd /Users/harukikondo/git/Arc-x402-sample
rm -rf pkgs/mcp/spike
git add pkgs/mcp/package.json pnpm-lock.yaml
git commit -m "chore(mcp): add wrangler and agents dependencies" -m "Privy SDKs confirmed to load on Workers (spike, removed)." -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: facilitator — 共通モジュール化(Node動作を維持)

**Files:**
- Modify: `pkgs/facilitator/src/viem.ts`
- Create: `pkgs/facilitator/src/facilitator.ts`
- Create: `pkgs/facilitator/src/app.ts`
- Modify: `pkgs/facilitator/src/index.ts`

**Interfaces:**
- Produces:
  - `createEvmSigner(privateKey: \`0x${string}\`, chain: Chain, rpcUrl?: string)` (`viem.ts`)
  - `type FacilitatorEnv = { EVM_PRIVATE_KEY: string; RPC_URL?: string }` と `createFacilitator(env: FacilitatorEnv): x402Facilitator` (`facilitator.ts`)
  - `createApp(facilitator: x402Facilitator): Hono` (`app.ts`)

- [ ] **Step 1: `viem.ts` を関数化**

`pkgs/facilitator/src/viem.ts` を次に置き換える(`dotenv`・`process.exit`・トップレベルの`privateKeyToAccount`を除去。`readContract` 等のラッパーは既存のまま):

```ts
import { toFacilitatorEvmSigner } from "@x402/evm";
import { type Chain, createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * 指定したチェーンのFacilitator EVM signerを作成する。
 * @param privateKey Facilitatorが決済トランザクションに署名する秘密鍵
 * @param chain 対象チェーン
 * @param rpcUrl 省略時はチェーン既定のRPC
 */
export const createEvmSigner = (
  privateKey: `0x${string}`,
  chain: Chain,
  rpcUrl?: string,
) => {
  const evmAccount = privateKeyToAccount(privateKey);
  console.info(`EVM Facilitator account: ${evmAccount.address}`);

  const viemClient = createWalletClient({
    account: evmAccount,
    chain,
    transport: http(rpcUrl),
  }).extend(publicActions);

  return toFacilitatorEvmSigner({
    getCode: (args: { address: `0x${string}` }) => viemClient.getCode(args),

    address: evmAccount.address,

    readContract: (args: {
      address: `0x${string}`;
      abi: readonly unknown[];
      functionName: string;
      args?: readonly unknown[];
    }) =>
      viemClient.readContract({
        ...args,
        args: args.args ?? [],
      }),

    verifyTypedData: (args: {
      address: `0x${string}`;
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
      signature: `0x${string}`;
    }) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      viemClient.verifyTypedData(args as any),

    writeContract: (args: {
      address: `0x${string}`;
      abi: readonly unknown[];
      functionName: string;
      args: readonly unknown[];
    }) =>
      viemClient.writeContract({
        ...args,
        args: args.args ?? [],
      }),

    sendTransaction: (args: { to: `0x${string}`; data: `0x${string}` }) =>
      viemClient.sendTransaction(args),

    waitForTransactionReceipt: (args: { hash: `0x${string}` }) =>
      viemClient.waitForTransactionReceipt(args),
  });
};
```

注意: 元コードでは `viemClient` が `any` 引数だった。`extend(publicActions)` の型のまま渡して `tsc` が通らない箇所があれば、その呼び出しに限り元コードと同様に `as any` + 理由コメントで回避する(型を握りつぶす広範な `any` は入れない)。

- [ ] **Step 2: `facilitator.ts` を作成(フック・スキーム登録)**

`pkgs/facilitator/src/facilitator.ts`:

```ts
import { x402Facilitator } from "@x402/core/facilitator";
import { ExactEvmScheme } from "@x402/evm/exact/facilitator";
import { UptoEvmScheme } from "@x402/evm/upto/facilitator";
import { chainInfo } from "./config.js";
import { createEvmSigner } from "./viem.js";

export type FacilitatorEnv = {
  EVM_PRIVATE_KEY: string;
  /** 省略時はチェーン既定のRPC */
  RPC_URL?: string;
};

/** フックのログに出してよい最小限のフィールド(署名・ペイロード本体は出さない) */
type HookContext = {
  requirements?: { scheme?: string; network?: string; amount?: string };
  result?: { success?: boolean; transaction?: string; errorReason?: string };
  error?: { message?: string };
};

const summarize = (context: object): Record<string, unknown> => {
  const { requirements, result, error } = context as HookContext;
  return {
    scheme: requirements?.scheme,
    network: requirements?.network,
    amount: requirements?.amount,
    success: result?.success,
    transaction: result?.transaction,
    errorReason: result?.errorReason,
    error: error?.message,
  };
};

const logStage = (stage: string, context: object): void => {
  console.log(`================ ${stage} ================`, summarize(context));
};

/** ファシリテーターインスタンスを生成し、exact / upto スキームを登録する */
export const createFacilitator = (env: FacilitatorEnv): x402Facilitator => {
  const evmSigner = createEvmSigner(
    env.EVM_PRIVATE_KEY as `0x${string}`,
    chainInfo.chain,
    env.RPC_URL,
  );

  const facilitator = new x402Facilitator()
    .onBeforeVerify(async (context) => logStage("Before verify", context))
    .onAfterVerify(async (context) => logStage("After verify", context))
    .onVerifyFailure(async (context) => logStage("Verify failure", context))
    .onBeforeSettle(async (context) => logStage("Before settle", context))
    .onAfterSettle(async (context) => logStage("After settle", context))
    .onSettleFailure(async (context) => logStage("Settle failure", context));

  const network = chainInfo.chainId as `eip155:${number}`;
  facilitator.register(
    network,
    new ExactEvmScheme(evmSigner, { eip6492AllowedFactories: [] }),
  );
  facilitator.register(network, new UptoEvmScheme(evmSigner));

  return facilitator;
};
```

フックのコンテキストの実フィールド名が異なる場合(`tsc` は `object` 経由なので通ってしまう)、Step 6 の実行ログで `scheme`/`network` が `undefined` のままなら `node_modules/@x402/core` の型定義でフックの `context` 型を確認して `HookContext` を合わせる。

- [ ] **Step 3: `app.ts` を作成(ルートを移動)**

`pkgs/facilitator/src/app.ts` を作る。元の `index.ts` の `// POST /verify` から `// Health check` までのルート定義を**そのまま**移し、`app` の生成とフックへの依存だけ変える:

```ts
import type { x402Facilitator } from "@x402/core/facilitator";
import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from "@x402/core/types";
import { Hono } from "hono";

/** /verify /settle /supported /health を提供するHonoアプリを作成する */
export const createApp = (facilitator: x402Facilitator): Hono => {
  const app = new Hono();

  // ここに元index.tsの app.post("/verify", ...) / app.post("/settle", ...) /
  // app.get("/supported", ...) / app.get("/health", ...) を一字一句そのまま貼る
  // (facilitator は引数のものを参照する。ロジック変更なし)

  return app;
};
```

貼り付けは機械的に行う(`sed -n '/POST \/verify/,/^\/\/ Start server/p'` で元の範囲を取り出し、最後の `// Start server` 見出しは含めない)。元の `index.ts` が変更前にコミット済みなので `git show HEAD:pkgs/facilitator/src/index.ts` で参照できる。

- [ ] **Step 4: `index.ts` をNodeエントリに縮める**

`pkgs/facilitator/src/index.ts` を次に置き換える:

```ts
import { serve } from "@hono/node-server";
import dotenv from "dotenv";
import { createApp } from "./app.js";
import { createFacilitator } from "./facilitator.js";

dotenv.config();

const PORT = Number(process.env.PORT ?? 4022);

if (!process.env.EVM_PRIVATE_KEY) {
  console.error("❌ EVM_PRIVATE_KEY environment variable is required");
  process.exit(1);
}

const facilitator = createFacilitator({
  EVM_PRIVATE_KEY: process.env.EVM_PRIVATE_KEY,
  RPC_URL: process.env.RPC_URL,
});

serve(
  {
    fetch: createApp(facilitator).fetch,
    port: PORT,
  },
  (info) => {
    console.log(`🚀 Facilitator listening on http://localhost:${info.port}`);
  },
);
```

- [ ] **Step 5: 型チェック**

```bash
pnpm facilitator run build
```

Expected: エラーなし(`dist/` が生成される。`dist/` は既に `.gitignore` 済みか `git status` で確認し、未ignoreならコミットに含めない)。

- [ ] **Step 6: Node動作の回帰確認**

```bash
cd /Users/harukikondo/git/Arc-x402-sample
pnpm facilitator run dev &
sleep 6
curl -s localhost:4022/health
curl -s localhost:4022/supported
kill %1
```

Expected: `{"status":"ok"}` と、`exact` と `upto` を含む `kinds` のJSON。ステップ2の `HookContext` 確認のため、可能なら `pnpm x402server run dev` も起動して `pnpm x402client run dev` を1回実行し、facilitatorのログに `scheme`/`network` が出ることを見る(ウォレット残高が必要。残高がなければ `HookContext` の確認は型定義の読み合わせで代える)。

- [ ] **Step 7: フォーマットとコミット**

```bash
pnpm exec biome check --write pkgs/facilitator/src
git add pkgs/facilitator/src/viem.ts pkgs/facilitator/src/facilitator.ts pkgs/facilitator/src/app.ts pkgs/facilitator/src/index.ts
git commit -m "refactor(facilitator): extract createApp/createFacilitator for multi-runtime use" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: facilitator — Workersエントリと wrangler 設定

**Files:**
- Modify: `pkgs/facilitator/package.json`, `pkgs/facilitator/tsconfig.json`
- Create: `pkgs/facilitator/wrangler.jsonc`, `pkgs/facilitator/tsconfig.worker.json`, `pkgs/facilitator/src/worker.ts`, `pkgs/facilitator/.dev.vars`(ローカルのみ・gitignore済み)

**Interfaces:**
- Consumes: `createFacilitator`, `FacilitatorEnv`, `createApp`(Task 2)
- Produces: Workersエントリ(`default export { fetch }`)。ローカルポート `8788`

- [ ] **Step 1: wranglerを追加しスクリプトを追記**

```bash
pnpm --filter facilitator add -D wrangler
```

`pkgs/facilitator/package.json` の `scripts` に追加:

```json
"cf:types": "wrangler types",
"cf:typecheck": "wrangler types && tsc -p tsconfig.worker.json",
"cf:dev": "wrangler dev --port 8788",
"cf:deploy": "wrangler deploy"
```

- [ ] **Step 2: `wrangler.jsonc`**

`pkgs/facilitator/wrangler.jsonc`:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "x402-arc-facilitator",
  "main": "src/worker.ts",
  "compatibility_date": "2026-09-22",
  "compatibility_flags": ["nodejs_compat"],
  "observability": {
    "enabled": true,
    "traces": { "enabled": true }
  }
}
```

`EVM_PRIVATE_KEY` は secret(`wrangler.jsonc` に書かない)。`RPC_URL` は任意で、必要なら `vars` に追加する。

- [ ] **Step 3: `worker.ts`**

`pkgs/facilitator/src/worker.ts`:

```ts
import type { Hono } from "hono";
import { createApp } from "./app.js";
import { createFacilitator } from "./facilitator.js";

// appは不変でリクエスト状態を持たないため、isolate内で1回だけ作ってキャッシュする
let app: Hono | undefined;

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    app ??= createApp(createFacilitator(env));
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
```

`Env` は `wrangler types` が生成するグローバル型。`EVM_PRIVATE_KEY` を型に含めるため、Step 5で `.dev.vars` を先に作ってから `wrangler types` を実行する(生成器は `.dev.vars` のキー名を読む)。

- [ ] **Step 4: tsconfigを分離**

`pkgs/facilitator/tsconfig.json` に除外を追加(Nodeビルドにworker.tsを含めない):

```json
"exclude": ["node_modules", "src/worker.ts"]
```

`pkgs/facilitator/tsconfig.worker.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["./worker-configuration.d.ts"]
  },
  "include": ["src/worker.ts", "worker-configuration.d.ts"]
}
```

`include` はworker.tsだけにする(`index.ts` はNodeの型が必要なため含めない。importされる `app.ts` `facilitator.ts` `viem.ts` `config.ts` は追従して型チェックされる)。

- [ ] **Step 5: ローカルsecretを作って型チェック**

`pkgs/facilitator/.dev.vars`(gitignore済みであることを `git check-ignore pkgs/facilitator/.dev.vars` で確認):

```
EVM_PRIVATE_KEY=<pkgs/facilitator/.env の EVM_PRIVATE_KEY と同じ値>
```

```bash
pnpm facilitator run cf:typecheck
pnpm facilitator run build
```

Expected: どちらもエラーなし。`worker-configuration.d.ts` と `@types/node` の型が衝突するエラーが出た場合は、`tsconfig.worker.json` の `types` が `["./worker-configuration.d.ts"]` のみになっているか確認する(`wrangler types` が `nodejs_compat` に応じて node の型参照を入れる場合は、生成物側の指示に従う)。

- [ ] **Step 6: ローカルで動作確認**

```bash
pnpm facilitator run cf:dev &
sleep 8
curl -s localhost:8788/health
curl -s localhost:8788/supported
kill %1
```

Expected: `{"status":"ok"}` と `exact`/`upto` を含む `/supported`。`Error: ...` でisolateが落ちる場合、ログの先頭エラーを確認する(典型: `nodejs_compat` 未設定、モジュール解決失敗)。`/settle` のCPU時間は実決済で確認する必要がある(Task 8のE2E。Freeプランの10ms CPU制限を超える場合はWorkers Paidが必要になる。結果をユーザーに報告する)。

- [ ] **Step 7: コミット**

```bash
pnpm exec biome check --write pkgs/facilitator
git add pkgs/facilitator/package.json pkgs/facilitator/tsconfig.json pkgs/facilitator/tsconfig.worker.json pkgs/facilitator/wrangler.jsonc pkgs/facilitator/src/worker.ts pnpm-lock.yaml
git commit -m "feat(facilitator): add Cloudflare Workers entrypoint" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: server — 共通モジュール化(Node動作を維持)

**Files:**
- Modify: `pkgs/server/src/config.ts`, `pkgs/server/src/facilitator.ts`, `pkgs/server/src/resourceServer.ts`, `pkgs/server/src/index.ts`
- Create: `pkgs/server/src/app.ts`

**Interfaces:**
- Produces:
  - `type ServerEnv = { FACILITATOR_URL: string; ASSET_ADDRESS: string; EVM_ADDRESS: string }`(`config.ts`)
  - `createX402Config(env: ServerEnv)`(`config.ts`。既存の `USAGE_UNIT_PRICE`, `USAGE_MAX_AMOUNT`, `CHAIN_ID` のexportは維持)
  - `createFacilitatorClient(url: string): HTTPFacilitatorClient`
  - `createResourceServer(facilitatorUrl: string): x402ResourceServer`
  - `createApp(env: ServerEnv): Hono`(`app.ts`)

仕様書の `PAY_TO` は、既存コードの実際の変数名 `EVM_ADDRESS` を使う(リネームしない)。

- [ ] **Step 1: `config.ts` を関数化**

`dotenv` の import と `dotenv.config()`、`import "dotenv/config"` を削除する。`x402Config` を `createX402Config` に変える。`process.env.ASSET_ADDRESS` → `env.ASSET_ADDRESS`、`process.env.EVM_ADDRESS` → `env.EVM_ADDRESS`。それ以外(コメント・値・`extensions`)は元のまま。

```ts
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { arcTestnet } from "viem/chains";

export type ServerEnv = {
  FACILITATOR_URL: string;
  ASSET_ADDRESS: string;
  EVM_ADDRESS: string;
};

// chain id
// Please replace this with your own chain id if you are using a different chain.
export const CHAIN_ID = `eip155:${arcTestnet.id}` as `${string}:${string}`;

// (ASSET_EXTRA / USAGE_UNIT_PRICE / USAGE_MAX_AMOUNT は元のまま)

// x402に関する設定
export const createX402Config = (env: ServerEnv) => ({
  "GET /weather": {
    accepts: [
      {
        scheme: "exact",
        price: {
          amount: "500000", // 0.5 USDC (decimals = 6)
          asset: env.ASSET_ADDRESS as `0x${string}`, // USDC
          extra: ASSET_EXTRA,
        },
        network: CHAIN_ID,
        payTo: env.EVM_ADDRESS as `0x${string}`,
      },
    ],
    // (description / mimeType / extensions は元のまま)
  },
  "GET /usage": {
    // (元のまま。asset / payTo だけ env から取る)
  },
});
```

`(…は元のまま)` と書いた箇所は、`git show HEAD:pkgs/server/src/config.ts` の内容をそのまま残すという意味。省略せずファイルに残すこと。

- [ ] **Step 2: `facilitator.ts` と `resourceServer.ts`**

`pkgs/server/src/facilitator.ts`:

```ts
import { HTTPFacilitatorClient } from "@x402/core/server";

// ファシリテータークライアントの設定
export const createFacilitatorClient = (url: string): HTTPFacilitatorClient =>
  new HTTPFacilitatorClient({ url });
```

`pkgs/server/src/resourceServer.ts`:

```ts
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { UptoEvmScheme } from "@x402/evm/upto/server";
import { x402ResourceServer } from "@x402/hono";
import { CHAIN_ID } from "./config";
import { createFacilitatorClient } from "./facilitator";

// リソースサーバーを作成し、対象チェーンに固定額決済(exact)と使用量課金(upto)のスキームを登録
export const createResourceServer = (
  facilitatorUrl: string,
): x402ResourceServer => {
  const resourceServer = new x402ResourceServer(
    createFacilitatorClient(facilitatorUrl),
  );
  resourceServer.register(CHAIN_ID, new ExactEvmScheme());
  resourceServer.register(CHAIN_ID, new UptoEvmScheme());
  return resourceServer;
};
```

元の `resourceServer.ts` にあった `84532` コメントは陳腐化しているのでこのタイミングで消える(CLAUDE.mdの「Stale Kaia leftovers」から該当項目を後で削除する)。

- [ ] **Step 3: `app.ts`(ルートを移動)**

`pkgs/server/src/app.ts`:

```ts
import { paymentMiddleware, setSettlementOverrides } from "@x402/hono";
import { Hono } from "hono";
import { createX402Config, type ServerEnv, USAGE_UNIT_PRICE } from "./config";
import { createResourceServer } from "./resourceServer";

// 1リクエストで受け付ける最大ユニット数(BigInt計算の入力を制限する)
const MAX_UNITS = 1000;

/** x402で課金されるHonoアプリを作成する */
export const createApp = (env: ServerEnv): Hono => {
  const app = new Hono();

  // x402ミドルウェアの設定
  app.use(
    paymentMiddleware(
      createX402Config(env),
      createResourceServer(env.FACILITATOR_URL),
    ),
  );

  // (元index.tsの app.get("/health"), app.get("/weather"), app.get("/usage") とその
  //  コメント(使用量課金のJSDoc含む)を一字一句そのまま貼る。MAX_UNITSの定義はこのファイル上部に移した)

  return app;
};
```

- [ ] **Step 4: `index.ts` をNodeエントリに縮める**

```ts
import { serve } from "@hono/node-server";
import dotenv from "dotenv";
import { createApp } from "./app";

dotenv.config();

const { FACILITATOR_URL, ASSET_ADDRESS, EVM_ADDRESS } = process.env;
if (!FACILITATOR_URL || !ASSET_ADDRESS || !EVM_ADDRESS) {
  console.error(
    "❌ FACILITATOR_URL, ASSET_ADDRESS and EVM_ADDRESS environment variables are required",
  );
  process.exit(1);
}

serve({
  fetch: createApp({ FACILITATOR_URL, ASSET_ADDRESS, EVM_ADDRESS }).fetch,
  port: 4021,
});
```

- [ ] **Step 5: Node動作の回帰確認**

```bash
cd /Users/harukikondo/git/Arc-x402-sample
pnpm facilitator run dev &
sleep 6
pnpm x402server run dev &
sleep 6
curl -s localhost:4021/health
curl -s -i localhost:4021/weather | head -20
kill %1 %2
```

Expected: `/health` は `{"report":{"status":"OK"}}`。`/weather` は `HTTP/1.1 402` で `payment-required` ヘッダ(または402のJSON)が返る。CLAUDE.mdの手順どおり facilitator → server の順に起動すること。

- [ ] **Step 6: フォーマットとコミット**

```bash
pnpm exec biome check --write pkgs/server/src
git add pkgs/server/src/config.ts pkgs/server/src/facilitator.ts pkgs/server/src/resourceServer.ts pkgs/server/src/app.ts pkgs/server/src/index.ts
git commit -m "refactor(server): extract createApp with env injection for multi-runtime use" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: server — Workersエントリと wrangler 設定

**Files:**
- Modify: `pkgs/server/package.json`
- Create: `pkgs/server/wrangler.jsonc`, `pkgs/server/tsconfig.worker.json`, `pkgs/server/src/worker.ts`, `pkgs/server/.dev.vars`(ローカルのみ)

**Interfaces:**
- Consumes: `createApp`, `ServerEnv`(Task 4)
- Produces: Workersエントリ。ローカルポート `8789`

- [ ] **Step 1: 依存とスクリプト**

```bash
pnpm --filter x402server add -D wrangler typescript
```

`pkgs/server/package.json` の `scripts` に追加:

```json
"cf:typecheck": "wrangler types && tsc -p tsconfig.worker.json",
"cf:dev": "wrangler dev --port 8789",
"cf:deploy": "wrangler deploy"
```

- [ ] **Step 2: 未使用チェーン依存の確認**

```bash
grep -rn "@x402/avm\|@x402/svm" /Users/harukikondo/git/Arc-x402-sample/pkgs/server/src
```

ヒットなし → `pnpm --filter x402server remove @x402/avm @x402/svm`(バンドル縮小)。ヒットあり → 残す。結果をコミットメッセージに書く。

- [ ] **Step 3: `wrangler.jsonc`**

`pkgs/server/.env`(ローカルのもの)から `ASSET_ADDRESS` と `EVM_ADDRESS` の値を読み、`vars` に入れる(どちらも公開アドレスでsecretではない)。`FACILITATOR_URL` はTask 8のデプロイ時に本番URLへ差し替える(今はローカル値)。

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "x402-arc-server",
  "main": "src/worker.ts",
  "compatibility_date": "2026-09-22",
  "compatibility_flags": ["nodejs_compat"],
  "observability": {
    "enabled": true,
    "traces": { "enabled": true }
  },
  "vars": {
    "FACILITATOR_URL": "http://localhost:8788",
    "ASSET_ADDRESS": "<pkgs/server/.env の ASSET_ADDRESS>",
    "EVM_ADDRESS": "<pkgs/server/.env の EVM_ADDRESS>"
  }
}
```

`<…>` は `.env` の実値に置換してからファイルに書く(プレースホルダをコミットしない)。

- [ ] **Step 4: `worker.ts` と tsconfig**

`pkgs/server/src/worker.ts`:

```ts
import type { Hono } from "hono";
import { createApp } from "./app";

// appは不変でリクエスト状態を持たないため、isolate内で1回だけ作ってキャッシュする
let app: Hono | undefined;

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    app ??= createApp(env);
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
```

`pkgs/server/tsconfig.worker.json`(facilitatorと同じ内容):

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["./worker-configuration.d.ts"]
  },
  "include": ["src/worker.ts", "worker-configuration.d.ts"]
}
```

- [ ] **Step 5: ローカル検証(facilitatorのWorkersと連携)**

`pkgs/server/.dev.vars` は不要(`FACILITATOR_URL` の既定値がローカルfacilitator `8788`)。

```bash
cd /Users/harukikondo/git/Arc-x402-sample
pnpm x402server run cf:typecheck
pnpm facilitator run cf:dev &
sleep 8
pnpm x402server run cf:dev &
sleep 8
curl -s localhost:8789/health
curl -s -i localhost:8789/weather | head -20
kill %1 %2
```

Expected: 型チェックOK、`/health` が `{"report":{"status":"OK"}}`、`/weather` が `402`。`x402ResourceServer` の初期化で facilitator の `/supported` を取りに行くので、facilitatorが先に起動している必要がある。

- [ ] **Step 6: コミット**

```bash
pnpm exec biome check --write pkgs/server
git add pkgs/server/package.json pkgs/server/tsconfig.worker.json pkgs/server/wrangler.jsonc pkgs/server/src/worker.ts pnpm-lock.yaml
git commit -m "feat(server): add Cloudflare Workers entrypoint" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: mcp — 共通ツール定義への分離(stdio動作を維持)

`index.ts` のツール定義を、env取得とウォレット保存を注入できる `registerTools` に切り出す。

**Files:**
- Modify: `pkgs/mcp/src/env.ts`, `pkgs/mcp/src/store.ts`, `pkgs/mcp/src/privy.ts`, `pkgs/mcp/src/index.ts`
- Create: `pkgs/mcp/src/tools.ts`

**Interfaces:**
- Produces:
  - `parseEnv(raw: unknown): Result<Env>`(`env.ts`。`loadEnv` は削除)。`Env` から `X402_MCP_HOME` を除く
  - `type WalletStore = { load(): Promise<Result<WalletState | undefined>>; save(state: WalletState): Promise<Result<null>> }`
  - `createFileStore(home: string | undefined): WalletStore`
  - `type KeyValueStorage = { get<T>(key: string): Promise<T | undefined>; put(key: string, value: unknown): Promise<void> }`
  - `createKvStore(storage: KeyValueStorage): WalletStore`
  - `type ToolDeps = { getEnv: () => Result<Env>; wallet: WalletStore }`
  - `createMcpServer(): McpServer` と `registerTools(server: McpServer, deps: ToolDeps): void`(`tools.ts`)

- [ ] **Step 1: `env.ts` を純粋関数化**

`dotenv`・`fileURLToPath`・`loadEnv`・`X402_MCP_HOME` を削除し、`envSchema` はそのまま、最後を次にする:

```ts
export type Env = z.infer<typeof envSchema>;

/** 環境変数(または Workers の env バインディング)を検証する。不足・不正なキー名だけを返し、値は含めない */
export const parseEnv = (raw: unknown): Result<Env> => {
  const parsed = envSchema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);

  const keys = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
  return fail(
    `Invalid or missing environment variables (PRIVY_APP_ID, PRIVY_APP_SECRET, PRIVY_CLIENT_ID, ASSET_ADDRESS, ALLOWED_PAYEES): ${keys.join(", ")}`,
  );
};
```

エラー文は「pkgs/mcp/.env」を前提にしない文言に変える(Workersでも意味が通るよう)。`import { fileURLToPath }` と `import dotenv` の行も削除する。

- [ ] **Step 2: `store.ts` にストア抽象を追加**

既存の `walletStateSchema` / `WalletState` / `stateFile` / `loadWalletState` / `saveWalletState` は残し、末尾に追加する。既存の関数は `createFileStore` の実装としてそのまま使う:

```ts
export type WalletStore = {
  load: () => Promise<Result<WalletState | undefined>>;
  save: (state: WalletState) => Promise<Result<null>>;
};

/** ローカルのファイルに保存するストア(stdio用) */
export const createFileStore = (home: string | undefined): WalletStore => ({
  load: () => loadWalletState(home),
  save: (state) => saveWalletState(home, state),
});

/** Durable Objectストレージ等のKey-Valueに保存するストア(Workers用) */
export type KeyValueStorage = {
  get: <T>(key: string) => Promise<T | undefined>;
  put: (key: string, value: unknown) => Promise<void>;
};

const WALLET_KEY = "wallet";

export const createKvStore = (storage: KeyValueStorage): WalletStore => ({
  load: async () => {
    const raw = await storage.get<unknown>(WALLET_KEY);
    if (raw === undefined) return ok(undefined);
    const parsed = walletStateSchema.safeParse(raw);
    return parsed.success ? ok(parsed.data) : fail("invalid wallet state in storage");
  },
  save: async (state) => {
    try {
      await storage.put(WALLET_KEY, state);
      return ok(null);
    } catch (error) {
      return fail(`failed to save wallet state: ${toMessage(error)}`);
    }
  },
});
```

`store.ts` の `node:fs` / `node:os` / `node:path` の import は残る。Workerのバンドルには `nodejs_compat` が入っているのでロード自体は通るが、`worker.ts` からは `createKvStore` だけを使う(fs関数は呼ばれない)。ロードで問題が出たら `createFileStore` 側を `store.node.ts` に分離する。

- [ ] **Step 3: `privy.ts` の委任キー生成をWebCryptoに置換**

`import { generateKeyPairSync } from "node:crypto";` を削除し、`generateDelegateKey` を次に置き換える:

```ts
const toBase64 = (buffer: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)));

/** 委任キー(P-256)を生成する。公開鍵は base64 DER(SPKI)、秘密鍵は base64 PKCS8 */
const generateDelegateKey = async (): Promise<{
  publicKey: string;
  privateKey: string;
}> => {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const [spki, pkcs8] = await Promise.all([
    crypto.subtle.exportKey("spki", pair.publicKey),
    crypto.subtle.exportKey("pkcs8", pair.privateKey),
  ]);
  return { publicKey: toBase64(spki), privateKey: toBase64(pkcs8) };
};
```

`provisionWallet` 内の呼び出しを `const delegate = await generateDelegateKey();` に変える。

- [ ] **Step 4: 委任キー形式の同等性を確認**

WebCrypto版の出力が、元のNode版と同じ形式(SPKI/PKCS8 のDER base64)で、Nodeの鍵APIで読み戻せることを確認する:

```bash
cd /Users/harukikondo/git/Arc-x402-sample/pkgs/mcp
cat > /tmp/check-key.mjs <<'EOF'
import { createPrivateKey, createPublicKey } from "node:crypto";
const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const spki = Buffer.from(await crypto.subtle.exportKey("spki", pair.publicKey));
const pkcs8 = Buffer.from(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
const pub = createPublicKey({ key: spki, format: "der", type: "spki" });
const priv = createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });
console.log(pub.asymmetricKeyType, pub.asymmetricKeyDetails?.namedCurve, priv.asymmetricKeyType, "spki bytes:", spki.length);
EOF
node /tmp/check-key.mjs
rm /tmp/check-key.mjs
```

Expected: `ec prime256v1 ec spki bytes: 91`(Node版 `generateKeyPairSync("ec", { namedCurve: "P-256" })` のSPKIも91バイト)。実際のPrivyでこの鍵が受理されるかは未検証(CLAUDE.mdの既存の未検証事項と同じ。Task 8で実機確認する)。

- [ ] **Step 5: `tools.ts` を作成**

`pkgs/mcp/src/index.ts` の以下を `tools.ts` へ移す: `ToolResult` / `text` / `fromResult` / 各 `server.registerTool(...)` / `instructions` 文字列。変更点は3つだけ:

1. `withEnv` は `deps.getEnv()` を使う
2. `loadWalletState(env.X402_MCP_HOME)` → `deps.wallet.load()`、`saveWalletState(env.X402_MCP_HOME, wallet.data)` → `deps.wallet.save(wallet.data)`
3. 登録は関数内で行い、サーバー生成は別関数にする

骨格:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { approveBudget, readBalances } from "./chain.js";
import { MAX_BUDGET, PAYABLE_PATH } from "./constants.js";
import type { Env } from "./env.js";
import {
  createAuthClient,
  createPrivyClient,
  createSignerAccount,
  provisionWallet,
  sendLoginCode,
  verifyLoginCode,
} from "./privy.js";
import type { Result } from "./result.js";
import type { WalletStore } from "./store.js";
import { createPaymentClient, fetchPaid } from "./x402.js";

export type ToolDeps = {
  getEnv: () => Result<Env>;
  wallet: WalletStore;
};

// (ToolResult / text / fromResult は index.ts から元のまま移す)

/** ツール未登録のMCPサーバーを作る(名前と利用ガイドを設定) */
export const createMcpServer = (): McpServer =>
  new McpServer(
    { name: "x402-arc-demo", version: "1.0.0" },
    {
      instructions:
        "Runs the x402 payment demo on Arc Testnet with a Privy user-owned wallet. " +
        // (以降の instructions 文字列は index.ts の元のまま)
        "",
    },
  );

/** 5つのツール(wallet_status / wallet_login_start / wallet_login_verify / set_budget / pay_and_fetch)を登録する */
export const registerTools = (server: McpServer, deps: ToolDeps): void => {
  const withEnv = async (
    run: (env: Env) => Promise<ToolResult>,
  ): Promise<ToolResult> => {
    const env = deps.getEnv();
    return env.ok ? run(env.data) : text(env.error, true);
  };

  // server.registerTool("wallet_status", ...) など5つを元のまま貼る。
  // 置換は上の2点のみ:
  //   loadWalletState(env.X402_MCP_HOME) -> deps.wallet.load()
  //   saveWalletState(env.X402_MCP_HOME, wallet.data) -> deps.wallet.save(wallet.data)
};
```

`registerTools` は50行を超えるが、5ツールの宣言的な登録が並ぶだけなので分割しない(既存の `index.ts` と同じ構造を保つ方が差分が読みやすい)。

- [ ] **Step 6: `index.ts` をstdioエントリに縮める**

```ts
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import { parseEnv } from "./env.js";
import { createFileStore } from "./store.js";
import { createMcpServer, registerTools } from "./tools.js";

// cwdに依存せず、パッケージ直下の .env を読む(MCPはClaude Codeから任意のcwdで起動されうる)
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

// MCPのstdioはプロトコル専用なので、ログは必ず stderr に出す(console.error)

const server = createMcpServer();
registerTools(server, {
  getEnv: () => parseEnv(process.env),
  wallet: createFileStore(process.env.X402_MCP_HOME),
});

const main = async (): Promise<void> => {
  await server.connect(new StdioServerTransport());
  console.error("[x402mcp] ready on stdio");
};

main().catch((error) => {
  console.error("[x402mcp] fatal:", error);
  process.exit(1);
});
```

- [ ] **Step 7: 型チェックとstdio回帰確認**

```bash
cd /Users/harukikondo/git/Arc-x402-sample
pnpm x402mcp run typecheck
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' '{"jsonrpc":"2.0","method":"notifications/initialized"}' '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | pnpm --dir pkgs/mcp exec tsx src/index.ts 2>/dev/null | head -c 1500
```

Expected: 型エラーなし。出力に `"name":"x402-arc-demo"` と、5つのツール名(`wallet_status` … `pay_and_fetch`)が含まれる。

- [ ] **Step 8: コミット**

```bash
pnpm exec biome check --write pkgs/mcp/src
git add pkgs/mcp/src/env.ts pkgs/mcp/src/store.ts pkgs/mcp/src/privy.ts pkgs/mcp/src/tools.ts pkgs/mcp/src/index.ts
git commit -m "refactor(mcp): inject env and wallet store into tools for multi-runtime use" -m "Delegate key generation moves to WebCrypto so it runs on Workers." -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: mcp — Workersエントリ(McpAgent + Origin検証 + レート制限)

**Files:**
- Modify: `pkgs/mcp/package.json`
- Create: `pkgs/mcp/wrangler.jsonc`, `pkgs/mcp/tsconfig.worker.json`, `pkgs/mcp/src/guard.ts`, `pkgs/mcp/src/worker.ts`, `pkgs/mcp/.dev.vars`(ローカルのみ)

**Interfaces:**
- Consumes: `createMcpServer`, `registerTools`(`tools.ts`)、`parseEnv`、`createKvStore`(Task 6)
- Produces:
  - `guardRequest(request: Request, env: GuardEnv): Promise<Response | undefined>`(`guard.ts`。拒否時は403/429のResponse、通過時は `undefined`)
  - `X402Mcp`(Durable Object class)、Workersエントリ(`/mcp`)。ローカルポート `8790`

- [ ] **Step 1: スクリプト追加**

`pkgs/mcp/package.json` の `scripts` に追加:

```json
"cf:typecheck": "wrangler types && tsc -p tsconfig.worker.json",
"cf:dev": "wrangler dev --port 8790",
"cf:deploy": "wrangler deploy"
```

- [ ] **Step 2: `guard.ts`**

`pkgs/mcp/src/guard.ts`:

```ts
export type GuardEnv = {
  /** カンマ区切りで許可するOrigin。未設定ならOriginヘッダ付きのリクエストは全て拒否する */
  ALLOWED_ORIGINS?: string;
  RATE_LIMITER: { limit: (options: { key: string }) => Promise<{ success: boolean }> };
};

const parseOrigins = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

/**
 * /mcp を公開するための最低限の防御。
 * - Origin: ブラウザ経由(DNS rebinding等)のリクエストを拒否する。MCPクライアント(Claude Code等)はOriginを付けない
 * - レート制限: クライアントIPごとに、OTP送信の乱用を抑える
 * 拒否するなら Response を、通すなら undefined を返す
 */
export const guardRequest = async (
  request: Request,
  env: GuardEnv,
): Promise<Response | undefined> => {
  const origin = request.headers.get("Origin");
  if (origin !== null && !parseOrigins(env.ALLOWED_ORIGINS).includes(origin)) {
    return Response.json({ error: "origin not allowed" }, { status: 403 });
  }

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const { success } = await env.RATE_LIMITER.limit({ key: ip });
  if (!success) {
    return Response.json({ error: "rate limit exceeded" }, { status: 429 });
  }
  return undefined;
};
```

- [ ] **Step 3: `worker.ts`**

`pkgs/mcp/src/worker.ts`:

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { parseEnv } from "./env.js";
import { guardRequest } from "./guard.js";
import { createKvStore } from "./store.js";
import { createMcpServer, registerTools } from "./tools.js";

/** セッションごとに1つのDurable Object。ウォレット状態(委任キー含む)はこのDOのストレージにだけ置く */
export class X402Mcp extends McpAgent<Env> {
  server: McpServer = createMcpServer();

  async init(): Promise<void> {
    registerTools(this.server, {
      getEnv: () => parseEnv(this.env),
      wallet: createKvStore(this.ctx.storage),
    });
  }
}

const mcpHandler = X402Mcp.serve("/mcp");

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const denied = await guardRequest(request, env);
    if (denied) return denied;
    return mcpHandler.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
```

`McpAgent.serve` が使うDOバインディング名(`MCP_OBJECT`)は `agents` のバージョンで変わる可能性があるので、Step 4のwrangler設定と合わせて `node_modules/agents` の型・READMEで確認する(context7 `/websites/developers_cloudflare_agents` でも確認可)。`this.ctx.storage` が `KeyValueStorage`(`get<T>` / `put`)と型互換であることを `cf:typecheck` で確認する。

- [ ] **Step 4: `wrangler.jsonc`**

`PRIVY_APP_ID` / `PRIVY_CLIENT_ID` / `ASSET_ADDRESS` / `ALLOWED_PAYEES` は `pkgs/mcp/.env` の実値(secretではない識別子・アドレス)、`PAYWALL_API_BASE_URL` はTask 8で本番serverのURLへ差し替える(今はローカル値)。

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "x402-arc-mcp",
  "main": "src/worker.ts",
  "compatibility_date": "2026-09-22",
  "compatibility_flags": ["nodejs_compat"],
  "observability": {
    "enabled": true,
    "traces": { "enabled": true }
  },
  "durable_objects": {
    "bindings": [{ "name": "MCP_OBJECT", "class_name": "X402Mcp" }]
  },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["X402Mcp"] }],
  "ratelimits": [
    {
      "name": "RATE_LIMITER",
      "namespace_id": "4021",
      "simple": { "limit": 30, "period": 60 }
    }
  ],
  "vars": {
    "PRIVY_APP_ID": "<pkgs/mcp/.env の PRIVY_APP_ID>",
    "PRIVY_CLIENT_ID": "<pkgs/mcp/.env の PRIVY_CLIENT_ID>",
    "ASSET_ADDRESS": "<pkgs/mcp/.env の ASSET_ADDRESS>",
    "ALLOWED_PAYEES": "<pkgs/mcp/.env の ALLOWED_PAYEES>",
    "PAYWALL_API_BASE_URL": "http://localhost:8789"
  }
}
```

`<…>` は実値に置換してから書く。`namespace_id` はアカウント内で一意な整数文字列(他と衝突する場合は変える)。`PRIVY_APP_SECRET` はここに書かない。

`tsconfig.worker.json` は facilitator と同じ内容(`include` は `["src/worker.ts", "worker-configuration.d.ts"]`)。

`.dev.vars`(ローカルのみ):

```
PRIVY_APP_SECRET=<pkgs/mcp/.env の PRIVY_APP_SECRET>
```

- [ ] **Step 5: 型チェック**

```bash
pnpm x402mcp run cf:typecheck
```

Expected: エラーなし。`Env` に `MCP_OBJECT` / `RATE_LIMITER` / `PRIVY_APP_SECRET` が含まれる。`RATE_LIMITER` の生成型が `guard.ts` の `GuardEnv.RATE_LIMITER` と合わない場合は `guard.ts` 側を生成型(`RateLimit`)に合わせる。

- [ ] **Step 6: ローカルE2E**

```bash
cd /Users/harukikondo/git/Arc-x402-sample
pnpm x402mcp run cf:dev &
sleep 10

# 1) initialize が通る
curl -s -X POST localhost:8790/mcp \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' | head -c 600
echo

# 2) Origin付きは403
curl -s -o /dev/null -w "origin=%{http_code}\n" -X POST localhost:8790/mcp -H 'Origin: https://evil.example' -H 'content-type: application/json' -d '{}'

# 3) レート制限(31回以上で429になることを確認)
for i in $(seq 1 40); do curl -s -o /dev/null -w "%{http_code} " -X POST localhost:8790/mcp -H 'content-type: application/json' -d '{}'; done; echo
kill %1
```

Expected: (1) `serverInfo` に `x402-arc-demo` を含む応答、(2) `origin=403`、(3) 途中から `429` が混ざる(ローカルのRate Limiting bindingはwrangler devでも動く。動かない場合は結果をユーザーに報告して本番での確認に回す)。

さらにMCP Inspectorまたは `claude mcp add --transport http x402-local http://localhost:8790/mcp` で `wallet_status` を呼び、`needsWallet: true` が返ることを確認する(Privyの実ログインはTask 8で実施)。

- [ ] **Step 7: コミット**

```bash
pnpm exec biome check --write pkgs/mcp
git add pkgs/mcp/package.json pkgs/mcp/wrangler.jsonc pkgs/mcp/tsconfig.worker.json pkgs/mcp/src/guard.ts pkgs/mcp/src/worker.ts pnpm-lock.yaml
git commit -m "feat(mcp): add remote MCP Worker with McpAgent, origin check and rate limit" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: ルートscripts・手順書・実デプロイ(ユーザー確認つき)

**Files:**
- Modify: `package.json`, `CLAUDE.md`
- Create: `docs/cloudflare-deploy.md`

**Interfaces:**
- Consumes: 各パッケージの `cf:dev` / `cf:deploy` スクリプト(Task 3/5/7)

- [ ] **Step 1: ルートのscripts**

ルート `package.json` の `scripts` に追加:

```json
"cf:dev:facilitator": "pnpm --filter facilitator run cf:dev",
"cf:dev:server": "pnpm --filter x402server run cf:dev",
"cf:dev:mcp": "pnpm --filter x402mcp run cf:dev",
"deploy:facilitator": "pnpm --filter facilitator run cf:deploy",
"deploy:server": "pnpm --filter x402server run cf:deploy",
"deploy:mcp": "pnpm --filter x402mcp run cf:deploy"
```

(`pnpm deploy` はpnpmの組み込みコマンドなのでスクリプト名に `deploy` 単体を使わない。パッケージ側は `cf:deploy`。)

- [ ] **Step 2: 手順書 `docs/cloudflare-deploy.md`**

次の内容を含める(コマンドは上記のとおり):

1. 前提: Cloudflareアカウント、`pnpm exec wrangler login`、Workers Paidが必要になる可能性(`/settle` のCPU時間)
2. Secrets:
   ```bash
   pnpm --filter facilitator exec wrangler secret put EVM_PRIVATE_KEY
   pnpm --filter x402mcp exec wrangler secret put PRIVY_APP_SECRET
   ```
   `PRIVY_APP_SECRET` は参加者に渡さないこと
3. デプロイ順: facilitator → `pkgs/server/wrangler.jsonc` の `FACILITATOR_URL` を facilitator のURLに更新 → server → `pkgs/mcp/wrangler.jsonc` の `PAYWALL_API_BASE_URL` を server のURLに更新 → mcp
4. 動作確認コマンド(下のStep 4)
5. ログ確認: `pnpm --filter <pkg> exec wrangler tail`
6. **既知の制約**: MCPセッションが切れる(クライアント再接続・DOの破棄)と、そのセッションのDOに保存した委任キーが失われ、再度メールOTPでウォレットを作り直すことになる。旧ウォレットはユーザー所有のためPrivy側に残るが、この委任キーでは操作できない。ワークショップ用途として許容する

- [ ] **Step 3: CLAUDE.md を更新**

- 「Commands」に `pnpm cf:dev:*` / `pnpm deploy:*` を追記
- 「Architecture」に、Workers用エントリ(`worker.ts`)、共通モジュール(`app.ts` `tools.ts`)、MCPはDO+`/mcp`、`docs/cloudflare-deploy.md` への参照を1〜2行で追記
- 「Stale Kaia leftovers」から `84532` コメントの項目を削除(Task 4で解消済み)。`// Kaia testnet` コメントは `facilitator.ts` に移した際に残していないので、`grep -rn "Kaia" pkgs/*/src` で残存を確認して項目を更新
- 「Chain/asset config is duplicated」の記述に、Workersでは `wrangler.jsonc` の `vars`(server: `ASSET_ADDRESS` / `EVM_ADDRESS` / `FACILITATOR_URL`、mcp: `ASSET_ADDRESS` / `ALLOWED_PAYEES` / `PAYWALL_API_BASE_URL`)も切替対象であることを追記

- [ ] **Step 4: コミット**

```bash
pnpm exec biome check --write package.json
git add package.json CLAUDE.md docs/cloudflare-deploy.md
git commit -m "docs: add Cloudflare Workers deploy guide and root scripts" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: 【ユーザー確認】デプロイを実行する**

以下は外部(Cloudflareアカウント)への公開・secret設定を伴うため、**各コマンドの実行前にユーザーへ確認する**。承認された順に実行:

1. `pnpm --filter facilitator exec wrangler secret put EVM_PRIVATE_KEY`(ユーザー自身が `! ` プレフィックスで入力する。値をチャットに貼らせない)
2. `pnpm deploy:facilitator` → 出力されたURLを記録し、`curl -s <facilitator-url>/supported` で確認
3. `pkgs/server/wrangler.jsonc` の `FACILITATOR_URL` を上のURLに更新 → `pnpm deploy:server` → `curl -s <server-url>/health` と `curl -s -i <server-url>/weather`(402)
4. `pnpm --filter x402mcp exec wrangler secret put PRIVY_APP_SECRET`(同上、ユーザーが入力)
5. `pkgs/mcp/wrangler.jsonc` の `PAYWALL_API_BASE_URL` を server のURLに更新 → `pnpm deploy:mcp`

- [ ] **Step 6: 【ユーザー確認】リモートE2E**

1. 既存クライアントをリモートserverに向けて実行: `pkgs/client/.env` の向き先(`RESOURCE_SERVER_URL` 相当のキー。`pkgs/client/src` で実際のキー名を確認)を一時的にserverのURLにして `pnpm x402client run dev`。`/settle` が成功しトランザクションが確定するか、Workers Logsのエラー(CPU time exceeded等)がないか確認
2. MCP接続: `claude mcp add --transport http x402-arc-remote <mcp-url>/mcp`
3. `wallet_status` → `wallet_login_start` → `wallet_login_verify` を実施し、Privyの実ログイン・ウォレット作成・ポリシー適用(CLAUDE.mdで未検証だった部分)が通るか確認。`set_budget`(preview → confirm)→ `pay_and_fetch /weather` まで通す
4. 結果(成功したこと・失敗したこと)をそのままユーザーに報告する。CPU時間超過が出た場合はWorkers Paidの要否を提示する

- [ ] **Step 7: 仕上げ**

ユーザーの確認後、`FACILITATOR_URL` / `PAYWALL_API_BASE_URL` の更新をコミットし、PRを作る場合は `.claude/rules/git-workflow.md` に従う(`feat/…` ブランチからのPR、squash merge)。

```bash
git add pkgs/server/wrangler.jsonc pkgs/mcp/wrangler.jsonc
git commit -m "chore: point Workers vars at deployed URLs" -m "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
