import { json, requireAuth, githubGet, githubPut, decodeGithubJson, encodeGithubJson } from "../_shared.js";

// Перенос списка с Шикимори, MyAnimeList или AniList.
//
// Отдельный эндпоинт, а не save-review в цикле: тот пишет по коммиту на
// отзыв, и список в пятьсот тайтлов означал бы пятьсот коммитов и столько
// же чтений файла. Здесь файл читается один раз, все записи вливаются в
// память и сохраняются одним коммитом.
//
// Разбор выгрузки и все решения о соответствии оценок и статусов остаются
// на клиенте (js/import.js): сюда приходит уже готовый список записей в
// нашем формате. Задача этого файла — аккуратно слить его с тем, что есть.

// Contents API полноценно работает с файлами до мегабайта, а base64
// раздувает содержимое примерно на треть. Списки в пару сотен тайтлов
// проходят с запасом, но упереться в потолок молча нельзя — отвечаем
// понятной ошибкой.
const MAX_CONTENT_BYTES = 1_000_000;

// Из присланной записи берём только знакомые поля: клиент под замком
// админки, но собирать объект из чужого ввода целиком всё равно не стоит.
function sanitize(item) {
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : undefined);
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const date = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

  const ids = {};
  if (item.ids && typeof item.ids === "object") {
    for (const key of ["mal", "anilist", "tmdb", "igdb", "hardcover_edition"]) {
      const value = num(item.ids[key]);
      if (value) ids[key] = value;
    }
  }

  return {
    title: str(item.title),
    type: str(item.type),
    status: str(item.status),
    grade: str(item.grade),
    year: str(item.year),
    cover: str(item.cover),
    rewatch_count: Number.isFinite(Number(item.rewatch_count)) ? Number(item.rewatch_count) : 0,
    date_start: date(item.date_start),
    date_end: date(item.date_end),
    ids: Object.keys(ids).length ? ids : undefined,
  };
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

  const incoming = Array.isArray(body.items) ? body.items : null;
  if (!incoming || !incoming.length) {
    return json({ error: "Нечего импортировать" }, 400);
  }

  const repo = env.GITHUB_REPO;
  const ghToken = env.GITHUB_TOKEN;
  const path = "reviews.json";

  try {
    const getRes = await githubGet(repo, path, ghToken);
    if (!getRes.ok) {
      const errText = await getRes.text();
      return json({ error: `GitHub GET failed: ${getRes.status} — ${errText}` }, 500);
    }
    const fileData = await getRes.json();
    const sha = fileData.sha;
    const current = decodeGithubJson(fileData);

    const byMal = new Map();
    for (const review of current) {
      if (review?.ids?.mal) byMal.set(review.ids.mal, review);
    }
    let maxId = current.reduce((m, r) => Math.max(m, r.id ?? 0), 0);

    let added = 0;
    let updated = 0;

    for (const raw of incoming) {
      const item = sanitize(raw);
      if (!item.title || !item.ids?.mal) continue;

      const existing = byMal.get(item.ids.mal);
      if (existing) {
        if (!body.overwrite) continue;
        // Обновляем только то, что пришло из выгрузки. Текст отзыва,
        // флаг «любимое» и порядок — это своё, нажитое, и импорт их
        // не касается ни при каких настройках.
        existing.status = item.status;
        existing.grade = item.grade;
        existing.rewatch_count = item.rewatch_count;
        if (item.date_start) existing.date_start = item.date_start;
        if (item.date_end) existing.date_end = item.date_end;
        existing.ids = { ...(existing.ids || {}), ...item.ids };
        updated++;
        continue;
      }

      maxId++;
      current.push({
        title: item.title,
        url: null,
        type: item.type,
        status: item.status,
        favorite: false,
        source: null,
        url2: null,
        source2: null,
        year: item.year,
        format: null,
        cover: item.cover,
        cover_backup: null,
        date_start: item.date_start,
        rewatch_count: item.rewatch_count,
        date_end: item.date_end,
        favorites: null,
        preview: null,
        grade: item.grade,
        tags: [],
        id: maxId,
        ids: item.ids,
      });
      byMal.set(item.ids.mal, current[current.length - 1]);
      added++;
    }

    if (!added && !updated) {
      return json({ ok: true, added: 0, updated: 0 });
    }

    // Тот же порядок, что и у обычного сохранения отзыва.
    current.sort((a, b) => {
      const da = new Date(b.date_end || b.date_start || b.date || 0);
      const db = new Date(a.date_end || a.date_start || a.date || 0);
      return da - db;
    });

    const content = encodeGithubJson(current);
    if (content.length > MAX_CONTENT_BYTES) {
      return json({
        error:
          "Файл отзывов не влезает в лимит GitHub. Импортируй список частями " +
          "или удали часть записей.",
      }, 413);
    }

    const message = `reviews: импорт списка (+${added}, обновлено ${updated})`;
    const putRes = await githubPut(repo, path, content, sha, message, ghToken);
    if (!putRes.ok) {
      const err = await putRes.json();
      return json({ error: `GitHub PUT failed: ${putRes.status} — ${err.message}` }, 500);
    }

    return json({ ok: true, added, updated });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
