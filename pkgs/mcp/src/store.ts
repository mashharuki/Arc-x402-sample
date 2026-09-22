import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { fail, ok, type Result, toMessage } from "./result.js";

/** ローカルに保存するウォレット情報。delegateKey は委任キーの秘密鍵なので外に出さない */
const walletStateSchema = z.object({
  email: z.string(),
  userId: z.string(),
  walletId: z.string(),
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  // 追加署名者(key quorum)のID
  signerId: z.string(),
  policyId: z.string(),
  // 委任キーの秘密鍵(base64 PKCS8)。この端末のこのユーザーだけが持つ
  delegateKey: z.string(),
});

export type WalletState = z.infer<typeof walletStateSchema>;

const stateFile = (home: string | undefined): string =>
  join(home ?? join(homedir(), ".x402mcp"), "wallet.json");

/** 保存済みのウォレット情報を読む。未作成なら data は undefined */
export const loadWalletState = async (
  home: string | undefined,
): Promise<Result<WalletState | undefined>> => {
  const file = stateFile(home);
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (error) {
    const isMissing = (error as NodeJS.ErrnoException).code === "ENOENT";
    return isMissing
      ? ok(undefined)
      : fail(`failed to read ${file}: ${toMessage(error)}`);
  }

  const parsed = walletStateSchema.safeParse(JSON.parse(raw));
  return parsed.success
    ? ok(parsed.data)
    : fail(`invalid wallet state file: ${file}`);
};

/** ウォレット情報を保存する(ディレクトリ 0700 / ファイル 0600) */
export const saveWalletState = async (
  home: string | undefined,
  state: WalletState,
): Promise<Result<null>> => {
  const file = stateFile(home);
  try {
    await mkdir(join(file, ".."), { recursive: true, mode: 0o700 });
    await writeFile(file, JSON.stringify(state, null, 2), { mode: 0o600 });
    await chmod(file, 0o600);
    return ok(null);
  } catch (error) {
    return fail(`failed to save ${file}: ${toMessage(error)}`);
  }
};

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
    return parsed.success
      ? ok(parsed.data)
      : fail("invalid wallet state in storage");
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
