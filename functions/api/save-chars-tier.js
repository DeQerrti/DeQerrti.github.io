import { json, requireAuth, githubGet, githubPut, encodeGithubJson } from "../_shared.js";

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

  const repo    = env.GITHUB_REPO;
  const ghToken = env.GITHUB_TOKEN;
  const path    = "characters-tier.json";

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

    // Полная замена всего файла переданными данными
    if (!Array.isArray(body)) {
      return json({ error: "Ожидается массив тайтлов" }, 400);
    }

    const content = encodeGithubJson(body);
    const putRes  = await githubPut(repo, path, content, sha, "chars-tier: update", ghToken);

    if (!putRes.ok) {
      const err = await putRes.json();
      return json({ error: `GitHub PUT failed: ${putRes.status} — ${err.message}` }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
