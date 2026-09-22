import type { Hono } from "hono";
import { createApp } from "./app";

// appは不変でリクエスト状態を持たないため、isolate内で1回だけ作ってキャッシュする
let app: Hono | undefined;

// 必須の環境変数(エラーには値ではなくキー名のみを出す)
const REQUIRED_KEYS = [
  "FACILITATOR_URL",
  "ASSET_ADDRESS",
  "EVM_ADDRESS",
] as const;

export default {
  fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Response | Promise<Response> {
    // 未設定のままだと分かりにくいエラーになるため、先に検証する
    const missing = REQUIRED_KEYS.filter((key) => {
      const value: unknown = env[key];
      return typeof value !== "string" || value.length === 0;
    });
    if (missing.length > 0) {
      const message = `server misconfigured: missing ${missing.join(", ")}`;
      console.error(message);
      return Response.json({ error: message }, { status: 500 });
    }
    app ??= createApp(env);
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
