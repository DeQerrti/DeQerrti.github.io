import { json, requireAuth, githubGet, githubPut, decodeGithubJson, encodeGithubJson } from "../_shared.js";

// Удаление отзыва.
//
// Появилось позже остального и по конкретному поводу: завести запись было
// можно, поправить — можно, а убрать — нечем. Пока записи заводились по
// одной руками, с этим ещё жилось; с появлением импорта одна неудачная
// выгрузка стала означать сотню записей, которые нечем убрать.
//
// POST /api/delete-review  { id }
//
// Только по числовому id, без вариантов «а найди по названию». Здесь это
// не строгость ради строгости: под одним названием у человека спокойно
// лежат три «Jujutsu Kaisen» (манга и два сезона), и удаление по названию
// однажды снесло бы не ту запись. Плохо это тем, что заметили бы не сразу.
//
// Ссылок на отзыв больше нигде нет: «Любимое» держит признак в самой
// записи, а «Тайтлы» в тир-листе — это вид поверх reviews.json. Поэтому
// удаление ничего за собой не тянет и подчищать нечего.

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const authError = await requireAuth(request, env);
  if (authError) return authError;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad JSON" }, 400);
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return json({ error: "Нужен номер записи" }, 400);
  }

  const repo = env.GITHUB_REPO;
  const ghToken = env.GITHUB_TOKEN;
  const path = "reviews.json";

  try {
    const getRes = await githubGet(repo, path, ghToken);
    if (!getRes.ok) {
      const errText = await getRes.text();
      return json({ error: `GitHub GET failed: ${getRes.status} — ${errText}` }, 500);
    }
    const fileData = await getRes.json();
    const sha = fileData.sha;
    const current = decodeGithubJson(fileData);

    const idx = current.findIndex((r) => r.id === id);
    if (idx === -1) {
      // Скорее всего запись уже удалили в другой вкладке. Это не поломка,
      // но и «готово» отвечать нельзя — человек решит, что удалил не то.
      return json({ error: "Такой записи уже нет — возможно, её удалили раньше." }, 404);
    }

    const [removed] = current.splice(idx, 1);

    const content = encodeGithubJson(current);
    const message = `review: delete "${removed.title}"`;
    const putRes = await githubPut(repo, path, content, sha, message, ghToken);
    if (!putRes.ok) {
      const err = await putRes.json();
      return json({ error: `GitHub PUT failed: ${putRes.status} — ${err.message}` }, 500);
    }

    return json({ ok: true, title: removed.title });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
