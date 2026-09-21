import { generateKeyPairSync } from "node:crypto";
import Privy from "@privy-io/js-sdk-core";
import { PrivyClient } from "@privy-io/node";
import { createViemAccount, type PrivyViemAccount } from "@privy-io/node/viem";
import { CHAIN_NUMERIC_ID } from "./constants.js";
import type { Env } from "./env.js";
import { buildPolicy } from "./policy.js";
import { fail, ok, type Result, toMessage } from "./result.js";
import type { WalletState } from "./store.js";

/** js-sdk-core が要求する Storage の最小実装(ブラウザ外なのでメモリ上に持つ) */
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

export const createPrivyClient = (env: Env): PrivyClient =>
  new PrivyClient({ appId: env.PRIVY_APP_ID, appSecret: env.PRIVY_APP_SECRET });

/**
 * js-sdk-core はブラウザ前提でOriginを自前では付けない。
 * Node ではPrivyから "Must specify origin" で拒否されるため、privy.io宛のリクエストにだけ付与する
 */
let isOriginHeaderInstalled = false;

const installOriginHeader = (origin: string): void => {
  if (isOriginHeaderInstalled) return;
  isOriginHeaderInstalled = true;
  const baseFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = new URL(
      input instanceof Request ? input.url : input.toString(),
    );
    if (!url.hostname.endsWith(".privy.io")) return baseFetch(input, init);

    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    headers.set("Origin", origin);
    return baseFetch(input, { ...init, headers });
  };
};

/** メールOTPログイン用のクライアント(画面なしで動かす) */
export const createAuthClient = (env: Env): Privy => {
  installOriginHeader(env.PRIVY_ORIGIN);
  return new Privy({
    appId: env.PRIVY_APP_ID,
    clientId: env.PRIVY_CLIENT_ID,
    storage: new MemoryStorage(),
  });
};

export const sendLoginCode = async (
  auth: Privy,
  email: string,
): Promise<Result<null>> => {
  try {
    await auth.auth.email.sendCode(email);
    return ok(null);
  } catch (error) {
    console.error("[privy] sendLoginCode failed:", toMessage(error));
    return fail(`failed to send the login code: ${toMessage(error)}`);
  }
};

export type LoginSession = { userId: string };

/**
 * OTPを検証してログインする。
 * ユーザー本人であることの確認だけに使い、ユーザーのJWTは保持しない
 * (ウォレット作成はアプリの認証情報で行い、所有者にこのユーザーを指定する)
 */
export const verifyLoginCode = async (
  auth: Privy,
  email: string,
  code: string,
): Promise<Result<LoginSession>> => {
  try {
    const session = await auth.auth.email.loginWithCode(email, code);
    return ok({ userId: session.user.id });
  } catch (error) {
    console.error("[privy] verifyLoginCode failed:", toMessage(error));
    return fail(`login failed: ${toMessage(error)}`);
  }
};

/** 委任キー(P-256)を生成する。公開鍵は base64 DER(SPKI)、秘密鍵は base64 PKCS8 */
const generateDelegateKey = (): { publicKey: string; privateKey: string } => {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  return {
    publicKey: publicKey
      .export({ type: "spki", format: "der" })
      .toString("base64"),
    privateKey: privateKey
      .export({ type: "pkcs8", format: "der" })
      .toString("base64"),
  };
};

/**
 * ユーザー所有のウォレットを作成し、ポリシー付きの委任キーを追加署名者として登録する。
 * 1. 委任キーをローカルで生成(この端末のこのユーザー固有)
 * 2. 公開鍵を key quorum として登録
 * 3. ポリシーを作成(送金先・上限・チェーンを制限)
 * 4. ウォレットを作成(owner = ユーザー)。委任キーにはポリシーを上書き適用
 */
export const provisionWallet = async (
  privy: PrivyClient,
  env: Env,
  email: string,
  session: LoginSession,
): Promise<Result<WalletState>> => {
  try {
    const delegate = generateDelegateKey();

    const quorum = await privy.keyQuorums().create({
      // Privyの上限は50文字。did:privy:... は長いので末尾だけ使う
      display_name: `x402 delegate ${session.userId.slice(-20)}`,
      public_keys: [delegate.publicKey],
      authorization_threshold: 1,
    });

    const policy = await privy.policies().create(
      buildPolicy({
        chainId: CHAIN_NUMERIC_ID,
        asset: env.ASSET_ADDRESS,
        maxAmount: env.MAX_AMOUNT_PER_PAYMENT,
        payees: env.ALLOWED_PAYEES,
      }),
    );

    const wallet = await privy.wallets().create({
      chain_type: "ethereum",
      owner: { user_id: session.userId },
      additional_signers: [
        { signer_id: quorum.id, override_policy_ids: [policy.id] },
      ],
    });

    return ok({
      email,
      userId: session.userId,
      walletId: wallet.id,
      address: wallet.address as `0x${string}`,
      signerId: quorum.id,
      policyId: policy.id,
      delegateKey: delegate.privateKey,
    });
  } catch (error) {
    console.error("[privy] provisionWallet failed:", toMessage(error));
    return fail(`failed to create the wallet: ${toMessage(error)}`);
  }
};

/** 委任キーで署名する viem アカウント。署名のたびにPrivy側でポリシーが評価される */
export const createSignerAccount = (
  privy: PrivyClient,
  state: WalletState,
): PrivyViemAccount =>
  createViemAccount(privy, {
    walletId: state.walletId,
    address: state.address as `0x${string}`,
    authorizationContext: { authorization_private_keys: [state.delegateKey] },
  });
