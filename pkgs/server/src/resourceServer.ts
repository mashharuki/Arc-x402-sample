import { ExactEvmScheme } from "@x402/evm/exact/server";
import { UptoEvmScheme } from "@x402/evm/upto/server";
import { x402ResourceServer } from "@x402/hono";
import { CHAIN_ID } from "./config";
import { facilitatorClient } from "./facilitator";

// リソースサーバーの設定
export const resourceServer = new x402ResourceServer(facilitatorClient);

// 対象チェーンに固定額決済(exact)と使用量課金(upto)のスキームを登録
resourceServer.register(CHAIN_ID, new ExactEvmScheme());
resourceServer.register(CHAIN_ID, new UptoEvmScheme());
