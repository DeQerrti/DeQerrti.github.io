import { json, requireAuth, githubGet, githubPut } from "../_shared.js";

// Проверка, что название папки/файла не содержит ничего, кроме безопасных
// символов — дополнительно к safeGithubPath в _shared.js (та уже блокирует
// "..", здесь просто более узкий фильтр специально для этого эндпоинта).
function isSafeName(name) {
  return typeof name === "string" && name.length > 0 && name.length < 200 && !/[/\\]/.test(name);
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

  const { folder, filename, contentBase64, basePath } = body;
  const base = isSafeName(basePath) ? basePath : "chars";

  if (folder && !isSafeName(folder)) {
    return json({ error: "Недопустимое название папки" }, 400);
  }
  if (!isSafeName(filename)) {
    return json({ error: "Недопустимое название файла" }, 400);
  }
  if (!filename.toLowerCase().endsWith(".webp")) {
    return json({ error: "Ожидается файл .webp (конвертация происходит в браузере перед отправкой)" }, 400);
  }
  if (!contentBase64 || typeof contentBase64 !== "string") {
    return json({ error: "Нет содержимого файла" }, 400);
  }

  const repo    = env.GITHUB_REPO;
  const ghToken = env.GITHUB_TOKEN;
  const path    = folder ? `${base}/${folder}/${filename}` : `${base}/${filename}`;

  try {
    const getRes = await githubGet(repo, path, ghToken);
    let sha;
    if (getRes.status === 200) {
      sha = (await getRes.json()).sha;
    } else if (getRes.status !== 404) {
      const errText = await getRes.text();
      return json({ error: `GitHub GET failed: ${getRes.status} — ${errText}` }, 500);
    }

    const putRes = await githubPut(
      repo, path, contentBase64, sha,
      `${base}: ${sha ? "обновление" : "добавление"} "${path}"`,
      ghToken
    );

    if (!putRes.ok) {
      const err = await putRes.json();
      return json({ error: `GitHub PUT failed: ${putRes.status} — ${err.message}` }, 500);
    }

    return json({ ok: true, path });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
