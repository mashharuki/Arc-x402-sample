import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import dotenv from "dotenv";
import "dotenv/config";
import { arcTestnet } from "viem/chains";

dotenv.config();

// chain id
// Please replace this with your own chain id if you are using a different chain.
export const CHAIN_ID = `eip155:${arcTestnet.id}` as `${string}:${string}`;

// x402に関する設定
export const x402Config = {
  "GET /weather": {
    accepts: [
      {
        scheme: "exact",
        price: {
          amount: "500000", // 0.5 USDC (decimals = 6)
          asset: process.env.ASSET_ADDRESS as `0x${string}`, // USDC
          extra: {
            name: "USDC",
            version: "2",
          },
        },
        network: CHAIN_ID as `${string}:${string}`,
        payTo: process.env.EVM_ADDRESS as `0x${string}`,
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
};
