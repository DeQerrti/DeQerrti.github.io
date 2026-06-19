import { json, requireAuth, githubGet, githubPut, decodeGithubJson, encodeGithubJson } from "../_shared.js";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const authError = requireAuth(request, env);
  if (authError) return authError;

  let entry;
  try {
    entry = await request.json();
  } catch {
    return json({ error: "Bad JSON" }, 400);
  }

  const repo    = env.GITHUB_REPO;
  const ghToken = env.GITHUB_TOKEN;
  const path    = "favorites.json";

  // ── Перестановка порядка ───────────────────────
  if (Array.isArray(entry._reorder)) {
    const newOrder = entry._reorder; // массив id в новом порядке

    try {
      const getRes = await githubGet(repo, path, ghToken);
      if (!getRes.ok) {
        const errText = await getRes.text();
        return json({ error: `GitHub GET failed: ${getRes.status} — ${errText}` }, 500);
      }

      const fileData = await getRes.json();
      const sha      = fileData.sha;
      const current  = decodeGithubJson(fileData);

      // Перестраиваем массив согласно новому порядку id
      // Записи которых нет в newOrder — добавляем в конец (на всякий случай)
      const byId    = Object.fromEntries(current.map(r => [String(r.id), r]));
      const reordered = newOrder
        .map(id => byId[String(id)])
        .filter(Boolean);

      // Добавляем записи которые не попали в newOrder
      const inNew = new Set(newOrder.map(String));
      for (const r of current) {
        if (!inNew.has(String(r.id))) reordered.push(r);
      }

      const content = encodeGithubJson(reordered);
      const putRes  = await githubPut(repo, path, content, sha, "favorites: reorder", ghToken);

      if (!putRes.ok) {
        const err = await putRes.json();
        return json({ error: `GitHub PUT failed: ${putRes.status} — ${err.message}` }, 500);
      }

      return json({ ok: true });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  // ── Добавление / редактирование записи ────────
  if (!entry.name) {
    return json({ error: "Нужно имя" }, 400);
  }

  try {
    // Читаем текущий favorites.json (или создаём пустой если не существует)
    const getRes = await githubGet(repo, path, ghToken);
    let current = [];
    let sha     = null;
    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
      current = decodeGithubJson(fileData);
    } else if (getRes.status !== 404) {
      const errText = await getRes.text();
      return json({ error: `GitHub GET failed: ${getRes.status} — ${errText}` }, 500);
    }

    const isEdit = entry._editId !== undefined && entry._editId !== null;
    if (isEdit) {
      const editId = entry._editId;
      delete entry._editId;
      const idx = current.findIndex(r => String(r.id) === String(editId));
      if (idx === -1) return json({ error: `Запись с id «${editId}» не найдена` }, 404);
      if (current[idx].id !== undefined) entry.id = current[idx].id;
      current[idx] = entry;
    } else {
      delete entry._editId;
      const maxId = current.reduce((m, r) => Math.max(m, r.id ?? 0), 0);
      entry.id = maxId + 1;
      current.unshift(entry);
    }

    const content = encodeGithubJson(current);
    const message = isEdit
      ? `favorites: edit "${entry.name}"`
      : `favorites: add "${entry.name}"`;

    const putRes = await githubPut(repo, path, content, sha, message, ghToken);

    if (!putRes.ok) {
      const err = await putRes.json();
      return json({ error: `GitHub PUT failed: ${putRes.status} — ${err.message}` }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
