import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import dotenv from "dotenv";
import "dotenv/config";
import { kairos } from "viem/chains";

dotenv.config();

// chain id
// Please replace this with your own chain id if you are using a different chain.
export const CHAIN_ID = `eip155:${kairos.id}` as `${string}:${string}`;

// x402に関する設定
export const x402Config = {
  "GET /weather": {
    accepts: [
      {
        scheme: "exact",
        price: {
          amount: "10000000000000000000",
          asset: process.env.ASSET_ADDRESS as `0x${string}`, // JPYC
          extra: {
            name: "JPY Coin",
            version: "1",
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
