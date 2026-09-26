import { CHAIN, CHAIN_ID, CHAIN_NUMERIC_ID, LIMITS } from "@x402-sample/config";

// チェーンは pkgs/config/src/index.ts で一元管理している(server/facilitator/clientと共通)
export { CHAIN, CHAIN_ID, CHAIN_NUMERIC_ID };

// 予算(allowance)として一度に承認できる上限(atomic units)
export const MAX_BUDGET = LIMITS.maxBudget;

// pay_and_fetch で呼べるパス。x402 server のデモエンドポイントだけを許可する
export const PAYABLE_PATH = /^\/(weather|usage(\?units=\d{1,4})?)$/;
