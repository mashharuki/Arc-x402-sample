import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { CHAIN_ID, PRICING, TOKEN } from "@x402-sample/config";

export type ServerEnv = {
  FACILITATOR_URL: string;
  EVM_ADDRESS: string;
};

// チェーン・トークン・価格は pkgs/config/src/index.ts で一元管理している
export { CHAIN_ID };

// 決済トークンのEIP-712ドメイン。オンチェーンの name() / version() と一致させる必要がある
const ASSET_EXTRA = { name: TOKEN.name, version: TOKEN.version };

// 使用量課金(upto)の設定
// 上限(USAGE_MAX_AMOUNT)までをクライアントにPermit2署名で認可させ、実際の使用量分だけ決済する
export const USAGE_UNIT_PRICE = PRICING.usageUnit;
export const USAGE_MAX_AMOUNT = PRICING.usageMax;

// x402に関する設定
export const createX402Config = (env: ServerEnv) => ({
  "GET /weather": {
    accepts: [
      {
        scheme: "exact",
        price: {
          amount: PRICING.weather,
          asset: TOKEN.address,
          extra: ASSET_EXTRA,
        },
        network: CHAIN_ID,
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
          asset: TOKEN.address,
          extra: ASSET_EXTRA,
        },
        network: CHAIN_ID,
        payTo: env.EVM_ADDRESS as `0x${string}`,
      },
    ],
    description:
      "Usage-based billing sample (upto): settles only the consumed units up to the authorized maximum",
    mimeType: "application/json",
  },
});
