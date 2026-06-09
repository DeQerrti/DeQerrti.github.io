export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Проверяем авторизацию
  const cookie = request.headers.get("cookie") || "";
  const auth   = cookie.split(";").find(c => c.trim().startsWith("tasteid_auth="));
  const token  = auth?.split("=")[1]?.trim();
  if (token !== env.ADMIN_PASSWORD?.trim()) {
    return json({ error: "Не авторизован" }, 401);
  }

  let review;
  try {
    review = await request.json();
  } catch {
    return json({ error: "Bad JSON" }, 400);
  }

  const repo    = env.GITHUB_REPO;
  const ghToken = env.GITHUB_TOKEN;
  const apiUrl  = `https://api.github.com/repos/${repo}/contents/reviews.json`;

  // ── Перестановка порядка любимых тайтлов ──────
  // Приходит { _reorder_favorites: [id, id, id, ...] }
  if (Array.isArray(review._reorder_favorites)) {
    const newOrder = review._reorder_favorites;

    try {
      const getRes = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "TasteID-App"
        }
      });
      if (!getRes.ok) {
        const errText = await getRes.text();
        return json({ error: `GitHub GET failed: ${getRes.status} — ${errText}` }, 500);
      }

      const fileData = await getRes.json();
      const sha      = fileData.sha;
      const raw      = Uint8Array.from(atob(fileData.content.replace(/\n/g, "")), c => c.charCodeAt(0));
      const current  = JSON.parse(new TextDecoder().decode(raw));

      // Проставляем fav_order согласно новому порядку
      const orderMap = {};
      newOrder.forEach((id, i) => { orderMap[String(id)] = i; });

      const updated = current.map(r => {
        if (r.favorite === true && orderMap[String(r.id)] !== undefined) {
          return { ...r, fav_order: orderMap[String(r.id)] };
        }
        return r;
      });

      const encoded = new TextEncoder().encode(JSON.stringify(updated, null, 2));
      const content = btoa(Array.from(encoded, b => String.fromCharCode(b)).join(""));

      const putRes = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "User-Agent": "TasteID-App"
        },
        body: JSON.stringify({ message: "favorites: reorder titles", content, sha }),
      });

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
    const getRes = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "TasteID-App"
      }
    });
    if (!getRes.ok) {
      const errText = await getRes.text();
      return json({ error: `GitHub GET failed: ${getRes.status} — ${errText}` }, 500);
    }

    const fileData = await getRes.json();
    const sha      = fileData.sha;
    const raw      = Uint8Array.from(atob(fileData.content.replace(/\n/g, "")), c => c.charCodeAt(0));
    let current    = JSON.parse(new TextDecoder().decode(raw));

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

    const encoded = new TextEncoder().encode(JSON.stringify(current, null, 2));
    const content = btoa(Array.from(encoded, b => String.fromCharCode(b)).join(""));
    const message = isEdit
      ? `review: edit "${review.title}"`
      : `review: add "${review.title}"`;

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "TasteID-App"
      },
      body: JSON.stringify({ message, content, sha }),
    });

    if (!putRes.ok) {
      const err = await putRes.json();
      return json({ error: `GitHub PUT failed: ${putRes.status} — ${err.message}` }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
