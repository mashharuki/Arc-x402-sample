import { arcTestnet } from "viem/chains";

// サーバー/facilitator/clientと同じチェーン(Arc Testnet)
export const CHAIN = arcTestnet;
export const CHAIN_NUMERIC_ID: number = arcTestnet.id;
export const CHAIN_ID = `eip155:${arcTestnet.id}` as `${string}:${string}`;

// 予算(allowance)として一度に承認できる上限(atomic units, USDC decimals=6 なので 10 USDC)
export const MAX_BUDGET = 10_000_000n;

// pay_and_fetch で呼べるパス。x402 server のデモエンドポイントだけを許可する
export const PAYABLE_PATH = /^\/(weather|usage(\?units=\d{1,4})?)$/;
