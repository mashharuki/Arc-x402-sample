import { parseUnits } from "viem";
import { arcTestnet } from "viem/chains";

/**
 * チェーン・トークン・価格・上限の共通設定
 *
 * 別のチェーンやトークンに切り替えるときは、このファイルだけを編集する。
 * server / facilitator / client / mcp はすべてここを参照する。
 * 切り替え後は、facilitatorのウォレットにそのチェーンのガス代を入れること。
 */

// ===== チェーン =====
// viem/chains の定義を差し替える(例: base, baseSepolia, kairos など)
export const CHAIN = arcTestnet;
export const CHAIN_NUMERIC_ID: number = CHAIN.id;
export const CHAIN_ID = `eip155:${CHAIN.id}` as `${string}:${string}`;

// ===== 決済トークン =====
// name / version はトークンのEIP-712ドメイン。オンチェーンの name() / version() と一致させる
// (versionが違うとfacilitatorのverifyが `FiatTokenV2: invalid signature` でrevertする)
export const TOKEN = {
  address: "0x3600000000000000000000000000000000000000" as `0x${string}`,
  name: "USDC",
  version: "2",
  decimals: 6,
} as const;

/** 人が読める金額("0.5")を、トークンの最小単位(atomic units)の文字列にする */
export const toAtomic = (amount: string): string =>
  parseUnits(amount, TOKEN.decimals).toString();

// ===== 価格(トークンの単位。USDCなら 0.5 = 0.5 USDC) =====
export const PRICING = {
  /** GET /weather(exact): 1リクエストの固定料金 */
  weather: toAtomic("0.5"),
  /** GET /usage(upto): 1ユニットあたりの料金 */
  usageUnit: parseUnits("0.1", TOKEN.decimals),
  /** GET /usage(upto): クライアントが署名で認可する最大額 */
  usageMax: toAtomic("0.5"),
} as const;

// ===== ガードレール =====
export const LIMITS = {
  /** clientが1回の支払いで署名を許可する上限(env MAX_AMOUNT_PER_PAYMENT で上書き可) */
  maxAmountPerPayment: toAtomic("1"),
  /** MCPのset_budgetが一度に承認できる予算の上限 */
  maxBudget: parseUnits("10", TOKEN.decimals),
} as const;
