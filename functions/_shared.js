// Общие утилиты для всех функций functions/api/*.js
// Имя с "_" Cloudflare Pages не считает за роут (как и _middleware.js)
//
// ВАЖНО: для сессий и рейт-лимита логина нужен KV namespace,
// забинженный к Pages-проекту под именем SESSIONS.
// Cloudflare Dashboard → Workers & Pages → проект → Settings →
// Functions → KV namespace bindings → Add binding:
//   Variable name: SESSIONS
//   KV namespace:  создать новый (например "tasteid-sessions")
// Без этого биндинга логин будет всегда отвечать 500.

const SESSION_TTL_SECONDS   = 60 * 60 * 24 * 7; // 7 дней, как раньше Max-Age
const RATE_LIMIT_WINDOW_SEC = 60 * 15;          // окно блокировки после превышения
const RATE_LIMIT_MAX_TRIES  = 5;                // неудачных попыток за окно

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function getCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  const found  = cookie.split(";").find(c => c.trim().startsWith(`${name}=`));
  return found?.split("=")[1]?.trim() || null;
}

// CF-Connecting-IP проставляется Cloudflare на edge и не подделывается
// клиентом (в отличие от X-Forwarded-For).
function getClientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

// ── Константное по времени сравнение строк ─────
// Обычное a !== b прерывается на первом несовпадающем байте — теоретически
// по разнице во времени ответа можно подбирать пароль посимвольно.
// Здесь перебираются все байты всегда, независимо от того, где нашлось
// первое расхождение.
export function timingSafeEqual(a, b) {
  const enc    = new TextEncoder();
  const aBytes = enc.encode(a ?? "");
  const bBytes = enc.encode(b ?? "");
  const len    = Math.max(aBytes.length, bBytes.length);
  let diff     = aBytes.length === bBytes.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

// ── Сессии ──────────────────────────────────────
// Токен — случайная строка, не пароль. Хранится в KV как
// session:<token> → { createdAt }. В куке лежит только токен:
// утечка куки больше не равна утечке пароля, и сессию можно
// мгновенно отозвать, удалив один ключ из KV.

export async function createSession(env) {
  const token = crypto.randomUUID() + crypto.randomUUID(); // ~244 бита энтропии
  await env.SESSIONS.put(
    `session:${token}`,
    JSON.stringify({ createdAt: Date.now() }),
    { expirationTtl: SESSION_TTL_SECONDS }
  );
  return token;
}

export async function destroySession(env, token) {
  if (!token) return;
  await env.SESSIONS.delete(`session:${token}`);
}

// Проверка куки авторизации. Возвращает true/false.
export async function checkAuth(request, env) {
  if (!env.SESSIONS) return false; // KV не забинжен — считаем неавторизованным
  const token = getCookie(request, "tasteid_auth");
  if (!token) return false;
  const session = await env.SESSIONS.get(`session:${token}`);
  return session !== null;
}

// Удобная обёртка: сразу возвращает Response с 401, если не авторизован
export async function requireAuth(request, env) {
  if (!(await checkAuth(request, env))) {
    return json({ error: "Не авторизован" }, 401);
  }
  return null;
}

// ── Рейт-лимит на попытки логина ───────────────
// Считаем неудачные попытки по IP. После RATE_LIMIT_MAX_TRIES неудач
// за RATE_LIMIT_WINDOW_SEC — дальнейшие попытки блокируются.
export async function isRateLimited(env, request) {
  if (!env.SESSIONS) return false;
  const cur = await env.SESSIONS.get(`loginfail:${getClientIp(request)}`);
  return cur !== null && parseInt(cur, 10) >= RATE_LIMIT_MAX_TRIES;
}

export async function recordFailedLogin(env, request) {
  if (!env.SESSIONS) return;
  const key = `loginfail:${getClientIp(request)}`;
  const cur = parseInt((await env.SESSIONS.get(key)) || "0", 10);
  await env.SESSIONS.put(key, String(cur + 1), { expirationTtl: RATE_LIMIT_WINDOW_SEC });
}

export async function resetFailedLogin(env, request) {
  if (!env.SESSIONS) return;
  await env.SESSIONS.delete(`loginfail:${getClientIp(request)}`);
}

function ghHeaders(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "TasteID-App",
    ...extra,
  };
}

// Режет путь на сегменты и кодирует каждый по отдельности (безопасно для
// папок с пробелами типа "Neural Cloud"), отклоняя "." и ".." — без этого
// path вида "../../" позволял бы через Contents API читать/писать файлы
// репозитория за пределами ожидаемой папки (chars/, корень и т.д.).
function safeGithubPath(path) {
  const segments = path.split("/").filter(Boolean);
  if (segments.some(s => s === "." || s === "..")) {
    throw new Error("Недопустимый путь");
  }
  return segments.map(encodeURIComponent).join("/");
}

// GET содержимого файла/папки в репозитории GitHub.
export async function githubGet(repo, path, token) {
  const safePath = safeGithubPath(path);
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

// Список коммитов, затронувших конкретный файл — основа для истории версий
// (вкладка "Бэкап" в админке). GitHub хранит их бессрочно, так что отдельного
// хранилища под снепшоты не нужно: каждое сохранение уже само по себе снепшот.
export async function githubListCommits(repo, path, token, perPage = 30) {
  const safePath = safeGithubPath(path);
  const res = await fetch(
    `https://api.github.com/repos/${repo}/commits?path=${safePath}&per_page=${perPage}`,
    { headers: ghHeaders(token) }
  );
  return res;
}

// Содержимое файла на конкретный коммит (ref = sha коммита)
export async function githubGetAtRef(repo, path, ref, token) {
  const safePath = safeGithubPath(path);
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${safePath}?ref=${encodeURIComponent(ref)}`,
    { headers: ghHeaders(token) }
  );
  return res;
}

// PUT (создание/обновление) файла в репозитории GitHub
export async function githubPut(repo, path, content, sha, message, token) {
  const safePath = safeGithubPath(path);
  const body = { message, content };
  if (sha) body.sha = sha;

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${safePath}`, {
    method: "PUT",
    headers: ghHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  return res;
}
