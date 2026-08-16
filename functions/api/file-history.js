import { json, requireAuth, githubListCommits } from "../_shared.js";

// Список версий (коммитов) для одного из отслеживаемых JSON-файлов.
// GET /api/file-history?path=reviews.json

const TRACKED_FILES = new Set([
  "reviews.json",
  "favorites.json",
  "characters-tier.json",
  "site-settings.json",
]);

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const authError = await requireAuth(request, env);
  if (authError) return authError;

  const url  = new URL(request.url);
  const path = url.searchParams.get("path") || "";
  if (!TRACKED_FILES.has(path)) {
    return json({ error: "Неизвестный файл" }, 400);
  }

  const repo    = env.GITHUB_REPO;
  const ghToken = env.GITHUB_TOKEN;

  try {
    const res = await githubListCommits(repo, path, ghToken, 50);
    if (!res.ok) {
      const errText = await res.text();
      return json({ error: `GitHub API failed: ${res.status} — ${errText}` }, 500);
    }
    const commits = await res.json();
    const versions = commits.map(c => ({
      sha: c.sha,
      date: c.commit?.author?.date || c.commit?.committer?.date || null,
      message: c.commit?.message || "",
    }));
    return json({ ok: true, path, versions });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
