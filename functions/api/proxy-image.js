diff --git a/functions/api/proxy-image.js b/functions/api/proxy-image.js
new file mode 100644
index 0000000..3501ec0
--- /dev/null
+++ b/functions/api/proxy-image.js
@@ -0,0 +1,111 @@
+// Публичный (без авторизации) прокси для обложек тайтлов.
+//
+// Зачем: годовой дайджест статистики "фотографируется" в картинку через
+// html2canvas на клиенте. Обложки тянутся с внешних CDN (TMDB/IGDB/AniList
+// и т.д.), и ни один из них не отдаёт Access-Control-Allow-Origin —
+// html2canvas не может прочитать пиксели такой картинки из-за CORS
+// и рисует на её месте пустой/чёрный прямоугольник. Картинки персонажей
+// в тир-листе этой проблемы не имеют — они лежат в этом же репозитории
+// на raw.githubusercontent.com, у которого CORS настроен нормально.
+//
+// Чтобы эндпоинт не превратился в открытый image-proxy для произвольных
+// URL (SSRF, чужой трафик за наш счёт, обход блокировок третьими лицами):
+//   1. Разрешены только https-ссылки на конкретные источники обложек,
+//      которые реально используются в данных сайта (см. ALLOWED_HOSTS).
+//   2. Отдаём наружу только ответы с Content-Type: image/*.
+//   3. Ограничиваем размер скачиваемого файла.
+//   4. Кэшируем результат на edge и в браузере — повторные экспорты
+//      дайджеста не будут заново дёргать чужой CDN.
+
+import { json } from "../_shared.js";
+
+// Корневые домены источников обложек. Поддомены разрешены (endsWith).
+// Если в будущем добавится новый источник обложек — дописать сюда.
+const ALLOWED_HOSTS = [
+  "themoviedb.org",
+  "tmdb.org",
+  "igdb.com",
+  "anilist.co",
+  "cdnlibs.org",
+  "hardcover.app",
+  "knizhnik.org",
+  "shikimori.io",
+  "shikimori.one",
+  "byrutgame.org",
+];
+
+const MAX_BYTES = 15 * 1024 * 1024; // 15 МБ — с запасом больше любой обложки
+
+function isAllowedHost(hostname) {
+  return ALLOWED_HOSTS.some(host => hostname === host || hostname.endsWith(`.${host}`));
+}
+
+export async function onRequest(context) {
+  const { request } = context;
+
+  if (request.method !== "GET") {
+    return new Response("Method Not Allowed", { status: 405 });
+  }
+
+  const reqUrl  = new URL(request.url);
+  const target  = reqUrl.searchParams.get("url");
+
+  if (!target) {
+    return json({ error: "Параметр url обязателен" }, 400);
+  }
+
+  let parsed;
+  try {
+    parsed = new URL(target);
+  } catch {
+    return json({ error: "Некорректный URL" }, 400);
+  }
+
+  if (parsed.protocol !== "https:") {
+    return json({ error: "Разрешён только https" }, 400);
+  }
+  if (parsed.username || parsed.password) {
+    return json({ error: "Некорректный URL" }, 400);
+  }
+  if (!isAllowedHost(parsed.hostname)) {
+    return json({ error: "Источник не входит в список разрешённых" }, 403);
+  }
+
+  let upstream;
+  try {
+    upstream = await fetch(parsed.toString(), {
+      headers: { "User-Agent": "TasteID-ImageProxy" },
+      cf: { cacheTtl: 86400, cacheEverything: true },
+    });
+  } catch {
+    return json({ error: "Не удалось получить изображение" }, 502);
+  }
+
+  if (!upstream.ok) {
+    return json({ error: `Источник вернул ${upstream.status}` }, 502);
+  }
+
+  const contentType = upstream.headers.get("Content-Type") || "";
+  if (!contentType.startsWith("image/")) {
+    return json({ error: "Источник вернул не изображение" }, 502);
+  }
+
+  const contentLength = parseInt(upstream.headers.get("Content-Length") || "0", 10);
+  if (contentLength > MAX_BYTES) {
+    return json({ error: "Изображение слишком большое" }, 502);
+  }
+
+  const buf = await upstream.arrayBuffer();
+  if (buf.byteLength > MAX_BYTES) {
+    return json({ error: "Изображение слишком большое" }, 502);
+  }
+
+  return new Response(buf, {
+    status: 200,
+    headers: {
+      "Content-Type": contentType,
+      "Access-Control-Allow-Origin": "*",
+      "Cache-Control": "public, max-age=86400",
+    },
+  });
+}
diff --git a/js/stats.js b/js/stats.js
index d574543..67d5f9f 100644
--- a/js/stats.js
+++ b/js/stats.js
@@ -392,6 +392,7 @@ async function statsExport(year) {
 
   let animated = [];
   let prevAnimation = [];
+  let proxied = [];
 
   try {
     const el = document.getElementById("stats-digest");
@@ -403,7 +404,19 @@ async function statsExport(year) {
       if (btn) btn.textContent = "⏳ Создаём…";
     }
 
+    // Обложки тянутся с внешних CDN (TMDB/IGDB/AniList и т.д.), которые не
+    // отдают CORS-заголовки — html2canvas не может прочитать их пиксели и
+    // рисует пустой прямоугольник вместо обложки. Прогоняем такие картинки
+    // через серверный прокси-эндпоинт с правильным Access-Control-Allow-Origin,
+    // а после скриншота возвращаем оригинальные src обратно.
     const imgs = Array.from(el.querySelectorAll("img"));
+    imgs.forEach(img => {
+      const src = img.getAttribute("src") || "";
+      if (!src || src.startsWith("data:") || src.startsWith(location.origin) || src.startsWith("/")) return;
+      proxied.push({ img, orig: src });
+      img.src = `/api/proxy-image?url=${encodeURIComponent(src)}`;
+    });
+
     await Promise.all(imgs.map(img =>
       img.complete ? Promise.resolve() : new Promise(res => {
         img.onload = img.onerror = res;
@@ -434,6 +447,7 @@ async function statsExport(year) {
     alert("Не удалось создать картинку 😢\n" + err.message);
   } finally {
     animated.forEach((node, i) => { node.style.animation = prevAnimation[i]; });
+    proxied.forEach(({ img, orig }) => { img.src = orig; });
     if (btn) { btn.textContent = "Сохранить как картинку"; btn.disabled = false; }
   }
 }
