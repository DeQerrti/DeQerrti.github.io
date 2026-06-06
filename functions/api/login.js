export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad JSON" }, 400);
  }

  const { password } = body;
  const expected = env.ADMIN_PASSWORD;

  if (!expected) {
    return json({ error: "ADMIN_PASSWORD не задан" }, 500);
  }

  if (password?.trim() !== expected.trim()) {
    return json({ error: "Неверный пароль" }, 401);
  }

  const cookieOpts = `Path=/; SameSite=Strict; Max-Age=604800`;

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // tasteid_auth — HttpOnly, для защиты маршрутов в middleware
      // tasteid_ui   — читается JS, для показа кнопки карандаша
      "Set-Cookie": [
        `tasteid_auth=${expected.trim()}; ${cookieOpts}; HttpOnly`,
        `tasteid_ui=1; ${cookieOpts}`
      ].join(", ")
    }
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
