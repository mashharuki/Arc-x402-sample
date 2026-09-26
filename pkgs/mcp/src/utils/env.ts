import { LIMITS } from "@x402-sample/config";
import { z } from "zod";
import { fail, ok, type Result } from "./result.js";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x address");
const atomic = z.string().regex(/^\d+$/, "must be an integer (atomic units)");

// 環境変数のスキーマ
const envSchema = z.object({
  PRIVY_APP_ID: z.string().min(1),
  PRIVY_APP_SECRET: z.string().min(1),
  PRIVY_CLIENT_ID: z.string().min(1),
  // Node の fetch は Origin を付けないため明示する。Privy Dashboard の Allowed origins に登録済みの値にする
  PRIVY_ORIGIN: z.url().default("http://localhost:5173"),
  // ポリシーで送金先として許可するアドレス(カンマ区切り)。x402 serverの EVM_ADDRESS を指定する
  ALLOWED_PAYEES: z
    .string()
    .min(1)
    .transform((value) => value.split(",").map((item) => item.trim()))
    .pipe(z.array(address).min(1)),
  PAYWALL_API_BASE_URL: z.url().default("http://localhost:4021"),
  // 1回の支払いの上限(atomic units)。clientの署名前チェックとPrivyポリシーの両方に使う
  MAX_AMOUNT_PER_PAYMENT: atomic.default(LIMITS.maxAmountPerPayment),
});

export type Env = z.infer<typeof envSchema>;

/** 環境変数(または Workers の env バインディング)を検証する。不足・不正なキー名だけを返し、値は含めない */
export const parseEnv = (raw: unknown): Result<Env> => {
  const parsed = envSchema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);

  const keys = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
  return fail(
    `Invalid or missing environment variables (PRIVY_APP_ID, PRIVY_APP_SECRET, PRIVY_CLIENT_ID, ALLOWED_PAYEES): ${keys.join(", ")}`,
  );
};
