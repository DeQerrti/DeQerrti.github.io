// ══════════════════════════════════════════════
//  SERVICE WORKER
//
//  manifest.json объявляет display: standalone, то есть сайт можно
//  установить как приложение. До этого файла установленное приложение
//  при плохой сети показывало пустой экран — кэшировать было нечему.
//
//  Стратегии по типу запроса:
//    оболочка (html/css/js)  — stale-while-revalidate: мгновенно из кэша,
//                              обновление подтягивается фоном к следующему разу
//    данные (*.json)         — сеть вперёд, кэш как запасной вариант:
//                              свежесть данных важнее скорости
//    картинки                — сначала кэш: файл под одним именем меняется
//                              редко, а весит много
//    /api/* и админка        — вообще не трогаем
// ══════════════════════════════════════════════

const VERSION = "v1";
const SHELL_CACHE = `tasteid-shell-${VERSION}`;
const DATA_CACHE = `tasteid-data-${VERSION}`;
const IMAGE_CACHE = `tasteid-img-${VERSION}`;

// Минимум, достаточный чтобы главная отрисовалась офлайн.
// Намеренно короткий список: чем он длиннее, тем выше шанс, что установка
// воркера целиком провалится из-за одного недоступного файла.
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/js/utils.js",
  "/js/theme.js",
  "/js/config.js",
  "/js/api.js",
  "/js/cards.js",
  "/js/now.js",
  "/js/favorites.js",
  "/js/reviews.js",
  "/js/stats.js",
  "/js/tierlist.js",
  "/manifest.json",
];

// Страницы админки кэшировать нельзя: их отдаёт _middleware.js только
// авторизованному, и закэшированная копия обошла бы эту проверку.
const NEVER_CACHE = [
  "/api/",
  "/add",
  "/chars-edit",
  "/favorites-edit",
  "/settings-edit",
  "/reviews-order",
  "/backup-history",
  "/login",
];

const IMAGE_PREFIXES = ["/chars/", "/covers/", "/title-covers/", "/covers-backup/", "/icons/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // addAll падает целиком, если хоть один файл не отдался, поэтому
      // кладём поштучно: пропущенный файл просто догрузится из сети.
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL_CACHE, DATA_CACHE, IMAGE_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE.some((prefix) => url.pathname.startsWith(prefix))) return;

  if (url.pathname.endsWith(".json")) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }
  if (IMAGE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }
  event.respondWith(staleWhileRevalidate(event, SHELL_CACHE));
});

// Кладём в кэш только удавшиеся ответы. Без этой проверки в кэш попал бы
// и 404, и он продолжил бы выдаваться после того, как файл появится.
async function putIfOk(cacheName, request, response) {
  if (!response || !response.ok || response.type === "opaque") return response;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName) {
  try {
    return await putIfOk(cacheName, request, await fetch(request));
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  return putIfOk(cacheName, request, await fetch(request));
}

// event нужен целиком, а не только request: фоновую догрузку надо отдать
// в event.waitUntil, иначе браузер вправе усыпить воркер сразу после
// ответа из кэша и обновление не доедет.
async function staleWhileRevalidate(event, cacheName) {
  const { request } = event;
  const cached = await caches.match(request);
  const network = fetch(request)
    .then((response) => putIfOk(cacheName, request, response))
    .catch(() => null);

  if (cached) {
    event.waitUntil(network);
    return cached;
  }

  const response = await network;
  if (response) return response;

  // Ни кэша, ни сети. Для навигации отдаём главную — она в кэше оболочки,
  // иначе браузер показал бы служебную страницу ошибки.
  if (request.mode === "navigate") {
    const fallback = await caches.match("/index.html");
    if (fallback) return fallback;
  }
  return Response.error();
}
