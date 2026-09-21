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

// 決済トークン(USDC)のEIP-712ドメイン。オンチェーンの name() / version() と一致させる必要がある
const ASSET_EXTRA = { name: "USDC", version: "2" };

// 使用量課金(upto)の設定。decimals = 6
// 上限(USAGE_MAX_AMOUNT)までをクライアントにPermit2署名で認可させ、実際の使用量分だけ決済する
export const USAGE_UNIT_PRICE = 100000n; // 1ユニット = 0.1 USDC
export const USAGE_MAX_AMOUNT = "500000"; // 認可上限 = 0.5 USDC

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
        network: CHAIN_ID as `${string}:${string}`,
        payTo: env.EVM_ADDRESS as `0x${string}`,
      },
    ],
    description:
      "Get real-time weather data including temperature, conditions, and humidity",
    mimeType: "application/json",
    extensions: {
      ...declareDiscoveryExtension({
        input: { city: "San Francisco" },
        inputSchema: {
          properties: { city: { type: "string", description: "City name" } },
          required: ["city"],
        },
      }),
    },
  },
  "GET /usage": {
    accepts: [
      {
        scheme: "upto",
        price: {
          amount: USAGE_MAX_AMOUNT,
          asset: env.ASSET_ADDRESS as `0x${string}`, // USDC
          extra: ASSET_EXTRA,
        },
        network: CHAIN_ID as `${string}:${string}`,
        payTo: env.EVM_ADDRESS as `0x${string}`,
      },
    ],
    description:
      "Usage-based billing sample (upto): settles only the consumed units up to the authorized maximum",
    mimeType: "application/json",
  },
});
