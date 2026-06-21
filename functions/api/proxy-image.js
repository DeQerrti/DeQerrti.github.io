// Публичный (без авторизации) прокси для обложек тайтлов.
//
// Зачем: годовой дайджест статистики "фотографируется" в картинку через
// html2canvas на клиенте. Обложки тянутся с внешних CDN (TMDB/IGDB/AniList
// и т.д.), и ни один из них не отдаёт Access-Control-Allow-Origin —
// html2canvas не может прочитать пиксели такой картинки из-за CORS
// и рисует на её месте пустой/чёрный прямоугольник. Картинки персонажей
// в тир-листе этой проблемы не имеют — они лежат в этом же репозитории
// на raw.githubusercontent.com, у которого CORS настроен нормально.
//
// Чтобы эндпоинт не превратился в открытый image-proxy для произвольных
// URL (SSRF, чужой трафик за наш счёт, обход блокировок третьими лицами):
//   1. Разрешены только https-ссылки на конкретные источники обложек,
//      которые реально используются в данных сайта (см. ALLOWED_HOSTS).
//   2. Отдаём наружу только ответы с Content-Type: image/*.
//   3. Ограничиваем размер скачиваемого файла.
//   4. Кэшируем результат на edge и в браузере — повторные экспорты
//      дайджеста не будут заново дёргать чужой CDN.

import { json } from "../_shared.js";

// Корневые домены источников обложек. Поддомены разрешены (endsWith).
// Если в будущем добавится новый источник обложек — дописать сюда.
const ALLOWED_HOSTS = [
  "themoviedb.org",
  "tmdb.org",
  "igdb.com",
  "anilist.co",
  "cdnlibs.org",
  "hardcover.app",
  "knizhnik.org",
  "shikimori.io",
  "shikimori.one",
  "byrutgame.org",
];

const MAX_BYTES = 15 * 1024 * 1024; // 15 МБ — с запасом больше любой обложки

function isAllowedHost(hostname) {
  return ALLOWED_HOSTS.some(host => hostname === host || hostname.endsWith(`.${host}`));
}

export async function onRequest(context) {
  const { request } = context;

  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const reqUrl  = new URL(request.url);
  const target  = reqUrl.searchParams.get("url");

  if (!target) {
    return json({ error: "Параметр url обязателен" }, 400);
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return json({ error: "Некорректный URL" }, 400);
  }

  if (parsed.protocol !== "https:") {
    return json({ error: "Разрешён только https" }, 400);
  }
  if (parsed.username || parsed.password) {
    return json({ error: "Некорректный URL" }, 400);
  }
  if (!isAllowedHost(parsed.hostname)) {
    return json({ error: "Источник не входит в список разрешённых" }, 403);
  }

  // Referer ставим на КОРНЕВОЙ домен источника (anilist.co), а не на
  // поддомен CDN (s4.anilist.co), с которого реально отдаётся файл —
  // CDN-картинки на этих сервисах встраиваются со страниц основного
  // домена, и Referer "сам на себя" антихотлинк-защита AniList
  // воспринимает как подозрительный и отвечает 403.
  const hostParts = parsed.hostname.split(".");
  const rootHost  = hostParts.length > 2 ? hostParts.slice(-2).join(".") : parsed.hostname;

  async function tryFetch(headers) {
    const controller = new AbortController();
    // 6с с запасом достаточно для нормального CDN; если источник просто
    // не отвечает (антибот вешает соединение, а не отбивает кодом),
    // лучше быстро вернуть внятную ошибку, чем дать Cloudflare-edge
    // самому оборвать всё по своему таймауту общей страницей 502.
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      return await fetch(parsed.toString(), {
        headers,
        signal: controller.signal,
        cf: { cacheTtl: 86400, cacheEverything: true },
      });
    } catch (e) {
      return { __failed: true, reason: e.name === "AbortError" ? "timeout" : (e.message || "network error") };
    } finally {
      clearTimeout(timer);
    }
  }

  // User-Agent — обычного браузера, без самоопознания как прокси/бот:
  // строки вида "ImageProxy"/"bot"/"crawler" в UA — первое, по чему
  // антибот-защита CDN (в т.ч. у AniList) фильтрует трафик, ещё до
  // разбора Referer и остальных заголовков.
  const BROWSER_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  let upstream = await tryFetch({
    "User-Agent": BROWSER_UA,
    "Referer": `${parsed.protocol}//${rootHost}/`,
    "Accept": "image/*",
  });

  // Некоторые источники (или конкретно их анти-бот защита) режут запросы
  // с Cloudflare edge вне зависимости от Referer. Пробуем второй раз вовсе
  // без Referer — части CDN он наоборот мешает (трактуется как чужой сайт).
  if (upstream.__failed || !upstream.ok) {
    upstream = await tryFetch({
      "User-Agent": BROWSER_UA,
      "Accept": "image/*",
    });
  }

  if (upstream.__failed) {
    return json({ error: `Не удалось получить изображение: ${upstream.reason}` }, 502);
  }
  if (!upstream.ok) {
    return json({ error: `Источник вернул ${upstream.status}` }, 502);
  }

  const contentType = upstream.headers.get("Content-Type") || "";
  if (!contentType.startsWith("image/")) {
    return json({ error: "Источник вернул не изображение" }, 502);
  }

  const contentLength = parseInt(upstream.headers.get("Content-Length") || "0", 10);
  if (contentLength > MAX_BYTES) {
    return json({ error: "Изображение слишком большое" }, 502);
  }

  const buf = await upstream.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) {
    return json({ error: "Изображение слишком большое" }, 502);
  }

  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
