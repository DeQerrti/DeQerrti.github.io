import { json, requireAuth, githubGet, githubPut, decodeGithubJson, encodeGithubJson } from "../_shared.js";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const authError = await requireAuth(request, env);
  if (authError) return authError;

  let review;
  try {
    review = await request.json();
  } catch {
    return json({ error: "Bad JSON" }, 400);
  }

  const repo    = env.GITHUB_REPO;
  const ghToken = env.GITHUB_TOKEN;
  const path    = "reviews.json";

  // ── Перестановка порядка любимых тайтлов ──────
  // Приходит { _reorder_favorites: [id, id, id, ...] }
  if (Array.isArray(review._reorder_favorites)) {
    const newOrder = review._reorder_favorites;

    try {
      const getRes = await githubGet(repo, path, ghToken);
      if (!getRes.ok) {
        const errText = await getRes.text();
        return json({ error: `GitHub GET failed: ${getRes.status} — ${errText}` }, 500);
      }

      const fileData = await getRes.json();
      const sha      = fileData.sha;
      const current  = decodeGithubJson(fileData);

      // Проставляем fav_order согласно новому порядку
      const orderMap = {};
      newOrder.forEach((id, i) => { orderMap[String(id)] = i; });

      const updated = current.map(r => {
        if (r.favorite === true && orderMap[String(r.id)] !== undefined) {
          return { ...r, fav_order: orderMap[String(r.id)] };
        }
        return r;
      });

      const content = encodeGithubJson(updated);
      const putRes  = await githubPut(repo, path, content, sha, "favorites: reorder titles", ghToken);

      if (!putRes.ok) {
        const err = await putRes.json();
        return json({ error: `GitHub PUT failed: ${putRes.status} — ${err.message}` }, 500);
      }

      return json({ ok: true });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  // ── Обычное сохранение / редактирование отзыва ─
  if (!review.title) {
    return json({ error: "Нужно название" }, 400);
  }

  try {
    const getRes = await githubGet(repo, path, ghToken);
    if (!getRes.ok) {
      const errText = await getRes.text();
      return json({ error: `GitHub GET failed: ${getRes.status} — ${errText}` }, 500);
    }

    const fileData = await getRes.json();
    const sha      = fileData.sha;
    let current    = decodeGithubJson(fileData);

    const isEdit = review._editId !== undefined && review._editId !== null;
    if (isEdit) {
      const editId = review._editId;
      delete review._editId;
      const idx = current.findIndex(r =>
        String(r.id) === String(editId) || r.title === editId
      );
      if (idx === -1) return json({ error: `Отзыв с id «${editId}» не найден` }, 404);
      // Сохраняем fav_order если он уже был
      if (current[idx].fav_order !== undefined && review.fav_order === undefined) {
        review.fav_order = current[idx].fav_order;
      }
      if (current[idx].id !== undefined) review.id = current[idx].id;
      current[idx] = review;
    } else {
      delete review._editId;
      const maxId = current.reduce((m, r) => Math.max(m, r.id ?? 0), 0);
      review.id   = maxId + 1;
      current.unshift(review);
    }

    // Сортируем по дате
    current.sort((a, b) => {
      const da = new Date(b.date_end || b.date_start || b.date || 0);
      const db = new Date(a.date_end || a.date_start || a.date || 0);
      return da - db;
    });

    const content = encodeGithubJson(current);
    const message = isEdit
      ? `review: edit "${review.title}"`
      : `review: add "${review.title}"`;

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
