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

  let entry;
  try {
    entry = await request.json();
  } catch {
    return json({ error: "Bad JSON" }, 400);
  }

  if (!entry.name) {
    return json({ error: "Нужно имя" }, 400);
  }

  const repo    = env.GITHUB_REPO;
  const ghToken = env.GITHUB_TOKEN;
  const apiUrl  = `https://api.github.com/repos/${repo}/contents/favorites.json`;

  try {
    // Читаем текущий favorites.json (или создаём пустой если не существует)
    const getRes = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "TasteID-App"
      }
    });

    let current = [];
    let sha     = null;

    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
      const raw = Uint8Array.from(atob(fileData.content.replace(/\n/g, "")), c => c.charCodeAt(0));
      current = JSON.parse(new TextDecoder().decode(raw));
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

    const encoded = new TextEncoder().encode(JSON.stringify(current, null, 2));
    const updated = btoa(Array.from(encoded, b => String.fromCharCode(b)).join(""));
    const message = isEdit
      ? `favorites: edit "${entry.name}"`
      : `favorites: add "${entry.name}"`;

    const putBody = { message, content: updated };
    if (sha) putBody.sha = sha;

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "TasteID-App"
      },
      body: JSON.stringify(putBody),
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
