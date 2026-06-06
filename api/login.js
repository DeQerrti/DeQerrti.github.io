export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const { password } = await req.json();
  if (password !== process.env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: "Неверный пароль" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `tasteid_auth=${process.env.ADMIN_PASSWORD}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`
    }
  });
}
