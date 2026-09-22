import { serve } from "@hono/node-server";
import dotenv from "dotenv";
import { createApp } from "./app";

dotenv.config();

const { FACILITATOR_URL, ASSET_ADDRESS, EVM_ADDRESS } = process.env;
if (!FACILITATOR_URL || !ASSET_ADDRESS || !EVM_ADDRESS) {
  console.error(
    "❌ FACILITATOR_URL, ASSET_ADDRESS and EVM_ADDRESS environment variables are required",
  );
  process.exit(1);
}

serve({
  fetch: createApp({ FACILITATOR_URL, ASSET_ADDRESS, EVM_ADDRESS }).fetch,
  port: 4021,
});
