export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Bad JSON: " + e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { password } = body;
  const expected = process.env.ADMIN_PASSWORD;

  // Временно возвращаем отладку (убрать после исправления)
  if (password !== expected) {
    return new Response(JSON.stringify({
      error: "Неверный пароль",
      debug_received_len: password?.length,
      debug_expected_len: expected?.length,
      debug_expected_set: !!expected,
    }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `tasteid_auth=${expected}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`
    }
  });
}
