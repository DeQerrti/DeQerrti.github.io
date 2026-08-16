import {
  json, requireAuth, githubGet, githubGetAtRef,
  githubPut, decodeGithubJson, encodeGithubJson,
} from "../_shared.js";

// Откатывает один из отслеживаемых файлов к содержимому старого коммита —
// не через git revert, а простой перезаписью текущего файла тем же
// содержимым (так в истории остаётся честная новая запись "восстановлено
// из версии от <коммит>", а не переписывание истории).
// POST /api/restore-file-version  { path, sha }

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

  const { path, sha } = body;
  if (!TRACKED_FILES.has(path)) {
    return json({ error: "Неизвестный файл" }, 400);
  }
  if (!isSafeSha(sha)) {
    return json({ error: "Недопустимый sha" }, 400);
  }

  const repo    = env.GITHUB_REPO;
  const ghToken = env.GITHUB_TOKEN;

  try {
    // Содержимое старой версии
    const oldRes = await githubGetAtRef(repo, path, sha, ghToken);
    if (!oldRes.ok) {
      const errText = await oldRes.text();
      return json({ error: `GitHub API failed (старая версия): ${oldRes.status} — ${errText}` }, 500);
    }
    const oldFileData = await oldRes.json();
    const oldData      = decodeGithubJson(oldFileData);

    // sha текущего файла (нужен для PUT)
    const curRes = await githubGet(repo, path, ghToken);
    if (!curRes.ok) {
      const errText = await curRes.text();
      return json({ error: `GitHub API failed (текущий файл): ${curRes.status} — ${errText}` }, 500);
    }
    const curFileData = await curRes.json();

    const content = encodeGithubJson(oldData);
    const shortSha = sha.slice(0, 7);
    const putRes = await githubPut(
      repo, path, content, curFileData.sha,
      `restore: ${path} → версия от коммита ${shortSha}`,
      ghToken
    );
    if (!putRes.ok) {
      const err = await putRes.json();
      return json({ error: `GitHub PUT failed: ${putRes.status} — ${err.message}` }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
