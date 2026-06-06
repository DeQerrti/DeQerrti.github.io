export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Bad JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { password } = body;
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return new Response(JSON.stringify({ error: "ADMIN_PASSWORD не задан" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (password.trim() !== expected.trim()) {
    return new Response(JSON.stringify({ error: "Неверный пароль" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `tasteid_auth=${expected.trim()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`
    }
  });
}
