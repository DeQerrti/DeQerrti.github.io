import { json, destroySession } from "../_shared.js";

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const cookie = request.headers.get("cookie") || "";
  const auth   = cookie.split(";").find(c => c.trim().startsWith("tasteid_auth="));
  const token  = auth?.split("=")[1]?.trim();

  if (env.SESSIONS) {
    await destroySession(env, token);
  }

  // Просрочиваем обе куки немедленно
  const cookieOpts = `Path=/; SameSite=Strict; Secure; Max-Age=0`;
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", `tasteid_auth=; ${cookieOpts}; HttpOnly`);
  headers.append("Set-Cookie", `tasteid_ui=; ${cookieOpts}`);

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
