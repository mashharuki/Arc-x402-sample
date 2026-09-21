import { ExactEvmScheme } from "@x402/evm/exact/server";
import { x402ResourceServer } from "@x402/hono";
import { facilitatorClient } from "./facilitator";
import { CHAIN_ID } from "./config";

// リソースサーバーの設定
export const resourceServer = new x402ResourceServer(facilitatorClient);
// EIP-155チェーンID84532のExactEvmSchemeを登録
resourceServer.register(
  CHAIN_ID,
  new ExactEvmScheme(),
);
