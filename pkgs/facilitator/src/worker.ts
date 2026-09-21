import type { Hono } from "hono";
import { createApp } from "./app.js";
import { createFacilitator } from "./facilitator.js";

// appは不変でリクエスト状態を持たないため、isolate内で1回だけ作ってキャッシュする
let app: Hono | undefined;

export default {
  fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Response | Promise<Response> {
    app ??= createApp(createFacilitator(env));
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
