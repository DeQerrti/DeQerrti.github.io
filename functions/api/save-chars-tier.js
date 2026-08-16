import { json, requireAuth, githubGet, githubPut, encodeGithubJson } from "../_shared.js";

function isSafeName(name) {
  return typeof name === "string" && name.length > 0 && name.length < 100 && !/[/\\.]/.test(name);
}

// "characters" — исторически хранится в characters-tier.json (не трогаем
// имя файла ради обратной совместимости), у остальных коллекций —
// tier-<id>.json
function collectionFile(collection) {
  return !collection || collection === "characters" ? "characters-tier.json" : `tier-${collection}.json`;
}

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

  // Обратная совместимость: раньше тело запроса было просто массивом
  // (всегда коллекция "characters"). Теперь ожидаем { collection, data }.
  const collection = Array.isArray(body) ? "characters" : body.collection;
  const data        = Array.isArray(body) ? body : body.data;

  if (!isSafeName(collection)) {
    return json({ error: "Недопустимое название коллекции" }, 400);
  }
  if (!Array.isArray(data)) {
    return json({ error: "Ожидается массив тайтлов" }, 400);
  }

  const repo    = env.GITHUB_REPO;
  const ghToken = env.GITHUB_TOKEN;
  const path    = collectionFile(collection);

  try {
    const getRes = await githubGet(repo, path, ghToken);

    let sha = null;

    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
    } else if (getRes.status !== 404) {
      const errText = await getRes.text();
      return json({ error: `GitHub GET failed: ${getRes.status} — ${errText}` }, 500);
    }

    const content = encodeGithubJson(data);
    const putRes  = await githubPut(repo, path, content, sha, `${collection}: update`, ghToken);

    if (!putRes.ok) {
      const err = await putRes.json();
      return json({ error: `GitHub PUT failed: ${putRes.status} — ${err.message}` }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
