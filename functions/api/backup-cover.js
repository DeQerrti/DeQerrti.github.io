import { json, requireAuth, githubGet, githubPut } from "../_shared.js";

// Скачивает картинку по внешней ссылке (на сервере — значит, никаких
// проблем с CORS, в отличие от попытки сделать это в браузере) и кладёт
// как резервную копию в репозиторий. Без конвертации в WebP — тут не до
// экономии места, тут задача "чтобы точно осталась копия", берём файл
// как есть, в исходном формате.

function isSafeName(name) {
  return typeof name === "string" && name.length > 0 && name.length < 200 && !/[/\\]/.test(name);
}

function extFromContentType(ct) {
  if (!ct) return "jpg";
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpg";
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

  const { url, filename } = body;
  if (!url || typeof url !== "string" || !/^https?:\/\//.test(url)) {
    return json({ error: "Нужна корректная ссылка (http/https)" }, 400);
  }
  if (!isSafeName(filename)) {
    return json({ error: "Недопустимое название файла" }, 400);
  }

  try {
    const imgRes = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (TasteID cover backup)" } });
    if (!imgRes.ok) {
      return json({ error: `Не удалось скачать картинку (${imgRes.status})` }, 502);
    }
    const buf = await imgRes.arrayBuffer();
    if (buf.byteLength === 0) {
      return json({ error: "Скачался пустой файл" }, 502);
    }
    if (buf.byteLength > 8 * 1024 * 1024) {
      return json({ error: "Файл слишком большой для бэкапа (>8МБ)" }, 400);
    }

    const ext = extFromContentType(imgRes.headers.get("content-type"));
    const path = `covers-backup/${filename}.${ext}`;

    let base64 = "";
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      base64 += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    base64 = btoa(base64);

    const repo    = env.GITHUB_REPO;
    const ghToken = env.GITHUB_TOKEN;

    const getRes = await githubGet(repo, path, ghToken);
    let sha;
    if (getRes.status === 200) sha = (await getRes.json()).sha;
    else if (getRes.status !== 404) {
      const errText = await getRes.text();
      return json({ error: `GitHub GET failed: ${getRes.status} — ${errText}` }, 500);
    }

    const putRes = await githubPut(
      repo, path, base64, sha,
      `covers-backup: ${sha ? "обновление" : "добавление"} "${path}"`,
      ghToken
    );
    if (!putRes.ok) {
      const err = await putRes.json();
      return json({ error: `GitHub PUT failed: ${putRes.status} — ${err.message}` }, 500);
    }
    const putData = await putRes.json();

    return json({ ok: true, path, url: putData.content?.download_url || null });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
