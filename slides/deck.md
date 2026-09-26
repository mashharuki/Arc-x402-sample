---
marp: true
theme: default
size: 16:9
paginate: true
style: |
  :root { --bg:#0B0F1A; --panel:#141B2D; --line:#26314D; --fg:#E8ECF4; --mute:#8B97B3; --cy:#22D3EE; --am:#FBBF24; --gr:#4ADE80; --rd:#F87171; }
  section { background:var(--bg); color:var(--fg); font-family:'Noto Sans JP','Hiragino Sans',sans-serif; font-size:28px; padding:56px 72px; line-height:1.55; }
  section::after { color:var(--mute); font-size:18px; }
  h1 { color:var(--fg); font-size:50px; border-bottom:3px solid var(--cy); padding-bottom:8px; margin-bottom:24px; }
  h2 { color:var(--cy); font-size:36px; margin:0 0 16px; }
  strong { color:var(--am); }
  code, pre { font-family:'JetBrains Mono','SF Mono',Menlo,monospace; }
  code { background:var(--panel); color:var(--cy); padding:2px 8px; border-radius:6px; font-size:0.85em; }
  pre { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:12px 18px; font-size:22px; }
  pre code { background:none; color:var(--fg); padding:0; }
  a { color:var(--cy); }
  ul { margin:0; padding-left:1.1em; } li { margin:6px 0; }
  .cy{color:var(--cy)} .am{color:var(--am)} .gr{color:var(--gr)} .rd{color:var(--rd)} .mute{color:var(--mute)}
  .cols { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
  .cols3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:16px 20px; }
  .card h3 { margin:0 0 6px; font-size:26px; color:var(--cy); }
  .card.am h3 { color:var(--am); } .card.gr h3 { color:var(--gr); }
  .card p { margin:4px 0; font-size:23px; }
  .big { font-size:64px; font-weight:700; line-height:1.2; }
  section.cover { justify-content:center; }
  section.cover h1 { font-size:54px; border:none; }
  section.section { justify-content:center; text-align:left; }
  section.section h1 { font-size:72px; border:none; color:var(--cy); }
  .tag { display:inline-block; background:var(--cy); color:var(--bg); font-weight:700; border-radius:8px; padding:2px 14px; font-size:24px; margin-bottom:12px; }
  .tag.am { background:var(--am); }
  .step { display:grid; grid-template-columns:1fr 1fr; grid-template-rows:auto auto; gap:14px; }
  .step .card { font-size:22px; padding:10px 16px; } .step .card h3 { font-size:20px; color:var(--mute); text-transform:none; }
  .step pre { font-size:20px; margin:4px 0; padding:8px 14px; }
  .flow { display:grid; grid-template-columns:repeat(4,1fr); gap:6px 0; font-size:20px; margin-top:6px; }
  .flow .h { text-align:center; font-weight:700; color:var(--bg); background:var(--cy); border-radius:8px; margin:0 6px; padding:2px 0; }
  .flow .h.am { background:var(--am); } .flow .h.gr { background:var(--gr); }
  .flow .r { border-radius:8px; padding:2px 12px; background:var(--panel); border:1px solid var(--line); margin:0 8px; }
  .flow .r.q { border-color:var(--cy); } .flow .r.p { border-color:var(--am); } .flow .r.ok { border-color:var(--gr); }
  .flow .n { color:var(--am); font-weight:700; }
---

<!-- _class: cover -->
<!-- _paginate: false -->

<span class="tag">Devcon 8 Workshop</span>

# x402 で AI エージェントに<br>お財布を持たせよう

<span class="mute">Autonomous Micropayments with Cloudflare Workers</span>

<!--
【日本語メモ】英訳時のタイトル: Building an x402-Powered AI Agent: Autonomous Micropayments with Cloudflare Workers
-->

---

# 自己紹介

<div class="cols">
<div>

## HARUKI

- 日本のエンジニア
- **UNCHAIN** コミュニティ運営
- **AWS Community Builder**

</div>
<div class="card">

<p class="mute">今日のテーマとの接点</p>
<p>AI エージェント × ステーブルコイン決済を、ハンズオンで一緒に触ります</p>

</div>
</div>

---

# 今日のゴールと 50 分

<div class="big cy">402 → 署名 → 検証 → 決済</div>
<p>を <strong>自分の手</strong> で動かし、<strong>上限超過が拒否される</strong> ところまで確認する</p>

<div class="cols3" style="margin-top:20px">
<div class="card"><h3>座学</h3><p class="big am" style="font-size:44px">10 分</p><p>x402 の全体像</p></div>
<div class="card"><h3>ハンズオン</h3><p class="big am" style="font-size:44px">35 分</p><p>Step 0〜3・集中タイム</p></div>
<div class="card"><h3>まとめ</h3><p class="big am" style="font-size:44px">5 分</p><p>デモ・次の一歩</p></div>
</div>

<!-- 手順の詳細は README。スライドは「今やること」だけ。 -->

---

# なぜ今 x402 か

<div class="cols">
<div class="card am">

### これまで
- OAuth・APIキー・手動課金
- 人間が契約・申込みしないと使えない
- <span class="rd">エージェントの自律取引に不向き</span>

</div>
<div class="card">

### x402
- HTTP <strong>402 Payment Required</strong> を実際に使う
- <span class="gr">アカウントもAPIキーも不要</span>
- リクエスト単位でステーブルコイン決済

</div>
</div>

<p class="mute" style="margin-top:20px">30 年眠っていた 402 を、2026 年に Coinbase と Cloudflare が復活させた</p>

---

# x402 のフロー

<div class="flow">
<div class="h">Agent</div><div class="h am">Server</div><div class="h gr">Facilitator</div><div class="h" style="background:var(--mute)">Chain</div>

<div class="r q" style="grid-column:1/3"><span class="n">①</span> GET /weather</div><div></div><div></div>
<div class="r q" style="grid-column:1/3"><span class="n">②</span> <b class="am">402</b> + 価格・宛先・トークン</div><div></div><div></div>
<div class="r p" style="grid-column:1/2"><span class="n">③</span> 署名する</div><div></div><div></div><div></div>
<div class="r q" style="grid-column:1/3"><span class="n">④</span> 再リクエスト + 署名</div><div></div><div></div>
<div class="r ok" style="grid-column:2/4"><span class="n">⑤</span> /verify(署名を検証)</div><div></div>
<div class="r ok" style="grid-column:3/5"><span class="n">⑥</span> /settle → 送金 tx</div>
<div class="r q" style="grid-column:1/3"><span class="n">⑦</span> <b class="gr">200</b> + データ + レシート</div><div></div><div></div>
</div>

<!-- 最重要スライド。①〜⑦を口頭で追う。Chain に触るのは Facilitator だけ、が要点。 -->

---

# 4 つの構成要素

<div class="cols3" style="grid-template-columns:repeat(4,1fr)">
<div class="card"><h3>Client</h3><p>署名するエージェント</p><p class="mute">viem + Privy</p></div>
<div class="card am"><h3>Server</h3><p>402 を返す有料API</p><p class="mute">Hono</p></div>
<div class="card gr"><h3>Facilitator</h3><p>検証と決済を代行</p><p class="mute">ガス代を負担</p></div>
<div class="card"><h3>Chain</h3><p>Arc Testnet</p><p class="mute">USDC</p></div>
</div>

<p style="margin-top:28px"><strong>Server はチェーンに触れない</strong>。検証と決済は Facilitator に任せる</p>

---

# Cloudflare Workers で動かす

<div class="cols">
<div>

- エッジで動く軽量な実行基盤
- ステートレスな API と相性が良い
- <strong>同じコード</strong>がローカル(Node)でも Workers でも動く

</div>
<div class="card">

<h3>今日の 3 つの Worker</h3>

- facilitator
- server(有料API)
- mcp(Claude Code から使う)

</div>
</div>

---

# ガードレール:使いすぎを防ぐ

<div class="cols3">
<div class="card"><h3>① クライアント</h3><p>署名前に 1 回の上限をチェック</p></div>
<div class="card am"><h3>② 署名の上限</h3><p>Permit2 署名で <strong>最大額</strong> を認可。超える決済は拒否</p></div>
<div class="card gr"><h3>③ 総予算</h3><p>USDC の <strong>allowance</strong> が合計の上限(無制限にしない)</p></div>
</div>

<p style="margin-top:24px">超えたら <span class="rd">送金されずエラー</span> になる。これを Step 3 で確かめる</p>

---

# 業界マップ

<div style="display:grid;grid-template-columns:150px 1fr 1fr;gap:12px;font-size:24px;margin-top:8px">
<div class="mute" style="align-self:center">認可<br><span style="font-size:18px">誰が許した?</span></div>
<div class="card gr" style="grid-column:2/4;text-align:center"><h3 style="margin:0">AP2</h3><p class="mute" style="margin:0">Google</p></div>
<div class="mute" style="align-self:center">支払い<br><span style="font-size:18px">どう払う?</span></div>
<div class="card" style="text-align:center"><h3 style="margin:0">x402</h3><p class="mute" style="margin:0">Coinbase · Cloudflare</p><p style="margin:0">ステーブルコイン</p></div>
<div class="card am" style="text-align:center"><h3 style="margin:0">MPP</h3><p class="mute" style="margin:0">Stripe · Tempo</p><p style="margin:0">ステーブルコイン + カード</p></div>
<div class="mute" style="align-self:center">入口<br><span style="font-size:18px">きっかけ</span></div>
<div class="card" style="grid-column:2/4;text-align:center;border-style:dashed"><b class="cy">HTTP 402</b> Payment Required</div>
</div>

<p style="margin-top:18px;text-align:center">x402 と MPP は<strong>補完関係</strong>。今日は <span class="cy">x402</span> を使う</p>

<!-- 【要確認】AP2 と x402 の関係は登壇直前に最新の公式情報で再確認すること。 -->

---

# 今日作るもの

<div class="cols">
<div class="card">

<h3>完成イメージ</h3>

Claude Code に話しかけると、エージェントが自分のウォレットで有料 API に支払う

</div>
<div>

1. **Step 1** x402 なしで起動
2. **Step 2** x402 を有効化 → 支払い成功
3. **Step 3** ガードレール → 超過を拒否

</div>
</div>

---

<!-- _class: section -->

# ハンズオン

<span class="mute">35 分・README に沿って自分のペースで</span>

---

<span class="tag">Step 0</span>

# 環境構築

<div class="step">
<div class="card"><h3>今やること</h3>リポジトリを取得し、<code>.env</code> を作る</div>
<div class="card"><h3>コマンド</h3>

```bash
pnpm i && pnpm run setup
```

</div>
<div class="card"><h3>期待される出力</h3>各パッケージに <code>.env</code> ができる</div>
<div class="card am"><h3>詰まったとき</h3>README「Prerequisites」を確認。faucet で USDC を受け取る</div>
</div>

---

<span class="tag">Step 1</span>

# x402 なしで起動

<div class="step">
<div class="card"><h3>今やること</h3><code>app.ts</code> の STEP 2 ブロックをコメントアウトして起動</div>
<div class="card"><h3>コマンド</h3>

```bash
pnpm x402server run dev
pnpm x402client run dev
```

</div>
<div class="card"><h3>期待される出力</h3><span class="gr">402 は返らず 200</span>。支払いは発生しない</div>
<div class="card am"><h3>詰まったとき</h3>ポート 4021 が使用中なら停止して再実行</div>
</div>

---

<span class="tag">Step 2</span>

# x402 を有効化

<div class="step">
<div class="card"><h3>今やること</h3>コメントアウトを外し、facilitator も起動して再実行</div>
<div class="card"><h3>コマンド</h3>

```bash
pnpm facilitator run dev
pnpm x402client run dev
```

</div>
<div class="card"><h3>期待される出力</h3><code>Payment settled</code> が表示され、天気データが返る</div>
<div class="card am"><h3>詰まったとき</h3><code>insufficient_balance</code> → 0.5 USDC 以上をfaucetで補充</div>
</div>

---

<span class="tag am">Step 3</span>

# ガードレール

<div class="step">
<div class="card"><h3>今やること</h3>総予算を設定し、上限超過の支払いを試す</div>
<div class="card"><h3>コマンド</h3>

```bash
pnpm x402client run approve 2 --execute
pnpm x402client run guardrails
```

</div>
<div class="card"><h3>期待される出力</h3><span class="rd">settlement_exceeds_amount</span> で拒否。送金は発生しない</div>
<div class="card am"><h3>詰まったとき</h3>allowance が 0 なら <code>approve</code> を先に実行</div>
</div>

---

# 詰まったとき早見表

| 症状 | 確認すること |
|---|---|
| 402 のまま進まない | facilitator と server が両方起動しているか |
| 残高不足 | Circle faucet(Arc Testnet)で USDC を補充 |
| 署名エラー | <code>ASSET_ADDRESS</code> と <code>CHAIN_ID</code> が全 <code>.env</code> で一致 |
| MCP が動かない | Privy の Allowed origins と <code>ALLOWED_PAYEES</code> |

<p class="mute">手を挙げてください。すぐに行きます</p>

---

<!-- _class: section -->

# 集中タイム

<span class="mute">自分のペースで Step 1 → 2 → 3。<br>終わった人は Workers へのデプロイや、別チェーンへの切替に挑戦</span>

---

# 完成版デモ

<div class="cols">
<div class="card">

<h3>Claude Code → MCP</h3>

「残高を確認して /usage?units=3 を支払って」

</div>
<div class="card am">

<h3>見どころ</h3>

- メールでログイン(Privy)
- 予算を設定して自動で支払い
- 上限超過は<span class="rd">拒否</span>

</div>
</div>

<!-- ライブが不安定なら録画を再生する。 -->

---

# まとめと次の一歩

<div class="cols">
<div>

- **402 → 署名 → 検証 → 決済** を体験した
- ガードレールで<strong>使いすぎを防げる</strong>
- Server はチェーンに触れず、Facilitator に任せる

</div>
<div class="card gr">

### 次の一歩
- 別のチェーン・トークンに切替(RPC・チェーンID・アドレスのみ)
- 自分の API に課金を組み込む
- 従量課金(upto)を試す

</div>
</div>

---

<!-- _class: cover -->
<!-- _paginate: false -->

# ありがとうございました

<span class="cy">github.com/mashharuki/Arc-x402-sample</span>

<span class="mute">HARUKI · UNCHAIN · @haruki_web3</span>
