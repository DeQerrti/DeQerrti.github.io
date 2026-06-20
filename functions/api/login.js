import {
  json,
  timingSafeEqual,
  createSession,
  isRateLimited,
  recordFailedLogin,
  resetFailedLogin,
} from "../_shared.js";

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env.SESSIONS) {
    return json({ error: "SESSIONS KV не забинжен в настройках Pages" }, 500);
  }

  // Рейт-лимит: после нескольких неудачных попыток с одного IP
  // дальнейшие попытки блокируются на время окна.
  if (await isRateLimited(env, request)) {
    return json(
      { error: "Слишком много попыток. Попробуйте позже." },
      429
    );
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

  // Сравнение константное по времени — обычное !== отдаёт ответ
  // чуть быстрее при несовпадении в начале строки, чем в конце,
  // и теоретически по этому можно подбирать пароль посимвольно.
  if (!timingSafeEqual(password?.trim() || "", expected.trim())) {
    await recordFailedLogin(env, request);
    return json({ error: "Неверный пароль" }, 401);
  }

  await resetFailedLogin(env, request);

  // Токен — случайная строка, а не сам пароль. Хранится в KV,
  // в куке лежит только он: утечка куки больше не равна утечке пароля,
  // а сессию можно отозвать в любой момент через /api/logout.
  const token = await createSession(env);

  const cookieOpts = `Path=/; SameSite=Strict; Secure; Max-Age=604800`;

  // Cloudflare не поддерживает два Set-Cookie через запятую —
  // используем Headers.append чтобы добавить два отдельных заголовка
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", `tasteid_auth=${token}; ${cookieOpts}; HttpOnly`);
  headers.append("Set-Cookie", `tasteid_ui=1; ${cookieOpts}`);

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
