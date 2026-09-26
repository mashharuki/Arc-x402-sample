import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { getChainId, getPricing, getToken } from "@x402-sample/config";

// チェーン・トークン・価格は .env(Workers では wrangler.jsonc の vars)から読み込む。
// 変数名の解釈は pkgs/config/src/index.ts にある
export type ServerEnv = {
  FACILITATOR_URL: string;
  EVM_ADDRESS: string;
  CHAIN_NAME: string;
  ASSET_ADDRESS: string;
  TOKEN_NAME: string;
  TOKEN_VERSION: string;
  TOKEN_DECIMALS: string;
  PRICE_WEATHER: string;
  USAGE_UNIT_PRICE: string;
  USAGE_MAX_AMOUNT: string;
};

/** 環境変数に不足や不正があればここで投げる(起動時に呼んで早く失敗させる) */
export const resolveServerConfig = (env: ServerEnv) => ({
  chainId: getChainId(env),
  token: getToken(env),
  pricing: getPricing(env),
});

// x402に関する設定
export const createX402Config = (env: ServerEnv) => {
  const { chainId, token, pricing } = resolveServerConfig(env);
  // 決済トークンのEIP-712ドメイン。オンチェーンの name() / version() と一致させる必要がある
  const assetExtra = { name: token.name, version: token.version };

  return {
    "GET /weather": {
      accepts: [
        {
          scheme: "exact",
          price: {
            amount: pricing.weather,
            asset: token.address,
            extra: assetExtra,
          },
          network: chainId,
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
            amount: pricing.usageMax,
            asset: token.address,
            extra: assetExtra,
          },
          network: chainId,
          payTo: env.EVM_ADDRESS as `0x${string}`,
        },
      ],
      description:
        "Usage-based billing sample (upto): settles only the consumed units up to the authorized maximum",
      mimeType: "application/json",
    },
  };
};
