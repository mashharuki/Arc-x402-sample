import { serve } from "@hono/node-server";
import dotenv from "dotenv";
import { createApp } from "./app.js";
import { createFacilitator } from "./facilitator.js";

dotenv.config();

const PORT = Number(process.env.PORT ?? 4022);

if (!process.env.EVM_PRIVATE_KEY) {
  console.error("❌ EVM_PRIVATE_KEY environment variable is required");
  process.exit(1);
}

const facilitator = createFacilitator({
  EVM_PRIVATE_KEY: process.env.EVM_PRIVATE_KEY,
  RPC_URL: process.env.RPC_URL,
});

serve(
  {
    fetch: createApp(facilitator).fetch,
    port: PORT,
  },
  (info) => {
    console.log(`🚀 Facilitator listening on http://localhost:${info.port}`);
  },
);
