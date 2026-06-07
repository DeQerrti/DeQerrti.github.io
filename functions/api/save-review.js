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

  // Валидация — URL обязателен только если есть превью или оценка
  const hasContent = review.preview || review.grade;
  if (!review.title) {
    return json({ error: "Нужно название" }, 400);
  }
  if (hasContent && !review.url) {
    return json({ error: "Нужна ссылка на источник" }, 400);
  }

  const repo    = env.GITHUB_REPO;
  const ghToken = env.GITHUB_TOKEN;
  const apiUrl  = `https://api.github.com/repos/${repo}/contents/reviews.json`;

  try {
    const getRes   = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: "application/vnd.github+json"
      }
    });
    const fileData = await getRes.json();
    const sha      = fileData.sha;

    // Читаем UTF-8 безопасно
    const raw   = Uint8Array.from(atob(fileData.content.replace(/\n/g, "")), c => c.charCodeAt(0));
    let current = JSON.parse(new TextDecoder().decode(raw));

    const isEdit = review._editId !== undefined && review._editId !== null;
    if (isEdit) {
      const editId = review._editId;
      delete review._editId;
      const idx = current.findIndex(r =>
        String(r.id) === String(editId) || r.title === editId
      );
      if (idx === -1) return json({ error: `Отзыв с id «${editId}» не найден` }, 404);
      if (current[idx].id !== undefined) review.id = current[idx].id;
      current[idx] = review;
    } else {
      delete review._editId;
      const maxId = current.reduce((m, r) => Math.max(m, r.id ?? 0), 0);
      review.id   = maxId + 1;
      current.unshift(review);
    }

    current.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    // Пишем UTF-8 безопасно
    const encoded = new TextEncoder().encode(JSON.stringify(current, null, 2));
    const updated = btoa(Array.from(encoded, b => String.fromCharCode(b)).join(""));

    const message = isEdit
      ? `review: edit "${review.title}"`
      : `review: add "${review.title}"`;

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, content: updated, sha }),
    });

    if (!putRes.ok) {
      const err = await putRes.json();
      return json({ error: err.message }, 500);
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
