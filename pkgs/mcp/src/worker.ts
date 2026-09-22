import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { parseEnv } from "./env.js";
import { guardRequest } from "./guard.js";
import { createKvStore } from "./store.js";
import { createMcpServer, registerTools } from "./tools.js";

/** セッションごとに1つのDurable Object。ウォレット状態(委任キー含む)はこのDOのストレージにだけ置く */
export class X402Mcp extends McpAgent<Env> {
  server: McpServer = createMcpServer();

  async init(): Promise<void> {
    registerTools(this.server, {
      getEnv: () => parseEnv(this.env),
      wallet: createKvStore(this.ctx.storage),
    });
  }
}

const mcpHandler = X402Mcp.serve("/mcp");

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const denied = await guardRequest(request, env);
    if (denied) return denied;
    return mcpHandler.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
