import { json, requireAuth, githubGet, decodeGithubJson } from "../_shared.js";

// Настройки прямо из репозитория, в обход выложенной копии.
//
// Зачем это понадобилось. Всё, что правит настройки, делает одно и то же:
// читает site-settings.json, меняет кусок, отправляет обратно целиком.
// Читало оно выложенный файл — тот, что отдаёт Cloudflare. А выложенная
// копия обновляется не сразу: коммит уезжает на GitHub, дальше сборка и
// раскладка по краю сети, и это десятки секунд.
//
// В это окно любая вторая правка читала ещё старый файл и отправляла его
// поверх свежего. Первая правка при этом исчезала молча: GitHub такую
// запись не отвергает — sha сервер перечитывает сам прямо перед записью,
// и он верный. Неверно содержимое.
//
// Поэтому у админки свой источник: здесь файл всегда тот, что лежит в
// репозитории сию секунду. Гостям он не нужен и не отдаётся — они ничего
// не пишут, и им хватает выложенной копии.
//
// GET /api/site-settings → содержимое site-settings.json

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const authError = await requireAuth(request, env);
  if (authError) return authError;

  try {
    const res = await githubGet(env.GITHUB_REPO, "site-settings.json", env.GITHUB_TOKEN);
    // Файла может не быть вовсе — это первый заход, а не поломка.
    if (res.status === 404) return json({});
    if (!res.ok) {
      const errText = await res.text();
      return json({ error: `GitHub GET failed: ${res.status} — ${errText}` }, 500);
    }
    return json(decodeGithubJson(await res.json()));
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
