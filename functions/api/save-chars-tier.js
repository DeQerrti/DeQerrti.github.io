export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const cookie = request.headers.get("cookie") || "";
  const auth   = cookie.split(";").find(c => c.trim().startsWith("tasteid_auth="));
  const token  = auth?.split("=")[1]?.trim();
  if (token !== env.ADMIN_PASSWORD?.trim()) {
    return json({ error: "Не авторизован" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Bad JSON" }, 400);
  }

  const repo    = env.GITHUB_REPO;
  const ghToken = env.GITHUB_TOKEN;
  const apiUrl  = `https://api.github.com/repos/${repo}/contents/characters-tier.json`;

  try {
    const getRes = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "TasteID-App"
      }
    });

    let sha     = null;
    let current = [];

    if (getRes.ok) {
      const fileData = await getRes.json();
      sha     = fileData.sha;
      const raw = Uint8Array.from(atob(fileData.content.replace(/\n/g, "")), c => c.charCodeAt(0));
      current = JSON.parse(new TextDecoder().decode(raw));
    } else if (getRes.status !== 404) {
      const errText = await getRes.text();
      return json({ error: `GitHub GET failed: ${getRes.status} — ${errText}` }, 500);
    }

    // Полная замена всего файла переданными данными
    if (!Array.isArray(body)) {
      return json({ error: "Ожидается массив тайтлов" }, 400);
    }

    const encoded = new TextEncoder().encode(JSON.stringify(body, null, 2));
    const content = btoa(Array.from(encoded, b => String.fromCharCode(b)).join(""));

    const putBody = {
      message: "chars-tier: update",
      content,
    };
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
