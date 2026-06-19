// Общие утилиты для всех функций functions/api/*.js
// Имя с "_" Cloudflare Pages не считает за роут (как и _middleware.js)

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// Проверка куки авторизации. Возвращает true/false.
export function checkAuth(request, env) {
  const cookie = request.headers.get("cookie") || "";
  const auth   = cookie.split(";").find(c => c.trim().startsWith("tasteid_auth="));
  const token  = auth?.split("=")[1]?.trim();
  return token === env.ADMIN_PASSWORD?.trim();
}

// Удобная обёртка: сразу возвращает Response с 401, если не авторизован
export function requireAuth(request, env) {
  if (!checkAuth(request, env)) {
    return json({ error: "Не авторизован" }, 401);
  }
  return null;
}

function ghHeaders(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "TasteID-App",
    ...extra,
  };
}

// GET содержимого файла/папки в репозитории GitHub.
// path подставляется через encodeURIComponent посегментно (безопасно для папок с пробелами типа "Neural Cloud").
export async function githubGet(repo, path, token) {
  const safePath = path.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${safePath}`, {
    headers: ghHeaders(token),
  });
  return res; // вызывающий код сам решает, как обработать ok/404/ошибку
}

// Декодирует base64-содержимое файла GitHub (item.content) в JS-объект/массив через JSON.parse
export function decodeGithubJson(fileData) {
  const raw = Uint8Array.from(atob(fileData.content.replace(/\n/g, "")), c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(raw));
}

// Кодирует объект/массив в base64 для записи через GitHub Contents API
export function encodeGithubJson(data) {
  const encoded = new TextEncoder().encode(JSON.stringify(data, null, 2));
  return btoa(Array.from(encoded, b => String.fromCharCode(b)).join(""));
}

// PUT (создание/обновление) файла в репозитории GitHub
export async function githubPut(repo, path, content, sha, message, token) {
  const safePath = path.split("/").map(encodeURIComponent).join("/");
  const body = { message, content };
  if (sha) body.sha = sha;

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${safePath}`, {
    method: "PUT",
    headers: ghHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  return res;
}
