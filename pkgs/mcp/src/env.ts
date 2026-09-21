import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";
import { fail, ok, type Result } from "./result.js";

// cwdに依存せず、パッケージ直下の .env を読む(MCPはClaude Codeから任意のcwdで起動されうる)
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x address");
const atomic = z.string().regex(/^\d+$/, "must be an integer (atomic units)");

const envSchema = z.object({
  PRIVY_APP_ID: z.string().min(1),
  PRIVY_APP_SECRET: z.string().min(1),
  PRIVY_CLIENT_ID: z.string().min(1),
  // 決済に使うトークン(USDC)のアドレス
  ASSET_ADDRESS: address,
  // ポリシーで送金先として許可するアドレス(カンマ区切り)。x402 serverの EVM_ADDRESS を指定する
  ALLOWED_PAYEES: z
    .string()
    .min(1)
    .transform((value) => value.split(",").map((item) => item.trim()))
    .pipe(z.array(address).min(1)),
  PAYWALL_API_BASE_URL: z.url().default("http://localhost:4021"),
  // 1回の支払いの上限(atomic units)。clientの署名前チェックとPrivyポリシーの両方に使う
  MAX_AMOUNT_PER_PAYMENT: atomic.default("1000000"),
  // ウォレット情報(委任キー)の保存先。省略時は ~/.x402mcp
  X402_MCP_HOME: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** 環境変数を検証する。不足・不正なキー名だけを返し、値は含めない */
export const loadEnv = (): Result<Env> => {
  const parsed = envSchema.safeParse(process.env);
  if (parsed.success) return ok(parsed.data);

  const keys = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
  return fail(
    `Invalid or missing environment variables in pkgs/mcp/.env: ${keys.join(", ")}`,
  );
};
