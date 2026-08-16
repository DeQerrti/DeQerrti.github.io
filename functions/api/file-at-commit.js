import { json, requireAuth, githubGetAtRef, decodeGithubJson } from "../_shared.js";

// Содержимое одного из отслеживаемых файлов на момент конкретного коммита.
// GET /api/file-at-commit?path=reviews.json&sha=abcdef

const TRACKED_FILES = new Set([
  "reviews.json",
  "favorites.json",
  "characters-tier.json",
  "site-settings.json",
]);

function isSafeSha(sha) {
  return typeof sha === "string" && /^[0-9a-f]{7,40}$/i.test(sha);
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const authError = await requireAuth(request, env);
  if (authError) return authError;

  const url  = new URL(request.url);
  const path = url.searchParams.get("path") || "";
  const sha  = url.searchParams.get("sha") || "";

  if (!TRACKED_FILES.has(path)) {
    return json({ error: "Неизвестный файл" }, 400);
  }
  if (!isSafeSha(sha)) {
    return json({ error: "Недопустимый sha" }, 400);
  }

  const repo    = env.GITHUB_REPO;
  const ghToken = env.GITHUB_TOKEN;

  try {
    const res = await githubGetAtRef(repo, path, sha, ghToken);
    if (!res.ok) {
      const errText = await res.text();
      return json({ error: `GitHub API failed: ${res.status} — ${errText}` }, 500);
    }
    const fileData = await res.json();
    const data = decodeGithubJson(fileData);
    return json({ ok: true, path, sha, data });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
