// ══════════════════════════════════════════════
//  IMPORT — перенос списка с Шикимори, MyAnimeList и AniList
//  Зависит от: utils.js, config.js, api.js
//
//  Рассчитано на человека, который переезжает со своим списком в
//  несколько сотен тайтлов. Поэтому импорт не «кнопка вслепую», а три
//  шага: загрузил файл — увидел, что нашлось, и сам решил, как их
//  оценки и статусы ложатся в твои — подтвердил. Сюрпризов быть не
//  должно: чужая выгрузка попадает в паспорт только после явного да.
//
//  Формат один на всех: Шикимори и AniList выгружают XML, совместимый
//  с MyAnimeList, — он же тут и разбирается. Ключ сопоставления —
//  series_animedb_id, то есть номер MAL: Шикимори использует его
//  напрямую, AniList хранит рядом со своим (см. js/external-ids.js).
// ══════════════════════════════════════════════

const IMPORT_ANILIST_ENDPOINT = "https://graphql.anilist.co";
const IMPORT_BATCH = 50; // AniList отдаёт до 50 записей за страницу

// Статусы MyAnimeList. Названия у аниме и манги разные («Watching» и
// «Reading»), но смысл один — сводим к общим ключам, чтобы человеку
// не пришлось настраивать одно и то же дважды.
const MAL_STATUS_KEYS = {
  watching: "Смотрю / читаю",
  completed: "Просмотрено / прочитано",
  onhold: "Отложено",
  dropped: "Брошено",
  plantowatch: "В планах",
};

function normalizeMalStatus(raw) {
  const s = (raw || "").toLowerCase().replace(/[\s_-]/g, "");
  if (s === "watching" || s === "reading") return "watching";
  if (s === "completed") return "completed";
  if (s === "onhold") return "onhold";
  if (s === "dropped") return "dropped";
  if (s === "plantowatch" || s === "plantoread") return "plantowatch";
  return null;
}

// MAL-овские типы записи в наши. Всё, чего нет в таблице, станет тем,
// что человек выберет для типа по умолчанию.
const MAL_TYPE_MAP = {
  tv: "anime",
  ova: "anime",
  ona: "anime",
  special: "anime",
  movie: "anime", // в списке аниме «Movie» — это полнометражка, а не кино
  music: "anime",
  manga: "manga",
  manhwa: "manhwa",
  manhua: "manhua",
  novel: "novel",
  lightnovel: "novel",
  oneshot: "manga",
  doujinshi: "manga",
};

let importData = null; // разобранная выгрузка
let importStep = "file"; // file | map | done
let importBusy = false;
let importStatusMap = {};
let importScoreMap = {};
let importSkipExisting = true;

// ── Разбор выгрузки ────────────────────────────

function parseMalExport(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Файл не читается как XML. Выгрузка с Шикимори иногда приходит в архиве — распакуй его сначала.");
  }

  const entries = [...doc.querySelectorAll("anime, manga")];
  if (!entries.length) {
    throw new Error("В файле нет ни одной записи. Нужна выгрузка списка с Шикимори, MyAnimeList или AniList.");
  }

  const text_ = (el, tag) => el.querySelector(tag)?.textContent?.trim() || "";
  const items = [];
  let skipped = 0;

  for (const el of entries) {
    const isManga = el.tagName.toLowerCase() === "manga";
    const malId = Number(text_(el, isManga ? "manga_mangadb_id" : "series_animedb_id"));
    const title = text_(el, "series_title") || text_(el, "manga_title");
    if (!malId || !title) { skipped++; continue; }

    const rawStatus = text_(el, "my_status");
    const status = normalizeMalStatus(rawStatus);
    const score = Number(text_(el, "my_score")) || 0;
    const rawType = (text_(el, "series_type") || text_(el, "manga_type") || "").toLowerCase().replace(/[\s_-]/g, "");

    items.push({
      malId,
      title,
      kind: isManga ? "manga" : "anime",
      type: MAL_TYPE_MAP[rawType] || (isManga ? "manga" : "anime"),
      status,
      rawStatus: rawStatus || "—",
      score, // 0 = не оценено
      rewatch: Number(text_(el, "my_times_watched")) || 0,
      dateStart: cleanMalDate(text_(el, "my_start_date")),
      dateEnd: cleanMalDate(text_(el, "my_finish_date")),
    });
  }

  if (!items.length) {
    throw new Error("Записи в файле есть, но ни у одной нет номера и названия — разобрать нечего.");
  }
  return { items, skipped };
}

// MAL пишет «не заполнено» как 0000-00-00; такая дата хуже, чем никакой.
function cleanMalDate(value) {
  if (!value || /^0{4}-0{2}-0{2}$/.test(value)) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

// ── Умолчания для соответствий ─────────────────
// Расставляются сами, но человек их правит: смысл шага именно в этом.

function defaultStatusMap() {
  const mine = activeStatusBuckets().map((b) => b.key);
  const has = (key) => mine.includes(key);
  return {
    watching: has("current") ? "current" : mine[0] || "completed",
    completed: "completed",
    onhold: has("onhold") ? "onhold" : "completed",
    // «Брошено» у большинства нет — тогда по умолчанию не тащим вовсе,
    // чтобы чужие брошенные не засоряли паспорт молча.
    dropped: has("dropped") ? "dropped" : "",
    plantowatch: has("planning") ? "planning" : "",
  };
}

// Десять баллов на N полок: делим шкалу пропорционально. Балл 10
// попадает на лучшую полку, 1 — на худшую, остальное между ними.
function defaultScoreMap() {
  const shelves = GRADE_ORDER;
  const map = {};
  for (let score = 1; score <= 10; score++) {
    const position = (10 - score) / 9; // 0 — лучшее, 1 — худшее
    const idx = Math.min(Math.round(position * (shelves.length - 1)), shelves.length - 1);
    map[score] = shelves[idx];
  }
  return map;
}

// ── Экран ──────────────────────────────────────

async function loadImport() {
  if (importBusy) return;
  importBusy = true;
  try {
    await fetchReviews();
    renderImport();
  } finally {
    importBusy = false;
  }
}

function renderImport() {
  const box = document.getElementById("importPanel");
  if (!box) return;
  box.innerHTML = importStyles() + (
    importStep === "map" ? importMapHtml() :
    importStep === "done" ? importDoneHtml() :
    importFileHtml()
  );
  bindImport();
}

function importFileHtml() {
  return `
    <p class="panel-intro">
      Перенос списка с Шикимори, MyAnimeList или AniList. Нужен файл выгрузки
      в формате XML: на Шикимори это Профиль → Настройки → Списки → Экспорт.
      Ничего никуда не отправляется — файл разбирается прямо здесь, а в паспорт
      записывается только после того, как ты подтвердишь.
    </p>
    <div class="imp-actions">
      <label class="imp-file-btn">
        <input type="file" id="imp-file" accept=".xml,application/xml,text/xml">
        <span>Выбрать файл выгрузки</span>
      </label>
    </div>
    <div class="status-msg" id="imp-status"></div>`;
}

// Что из выгрузки уже есть в паспорте — считаем по номеру MAL.
function splitImportItems() {
  const mine = new Map();
  for (const r of cache.reviews || []) {
    if (r.ids?.mal) mine.set(r.ids.mal, r);
  }
  const fresh = [];
  const existing = [];
  for (const item of importData.items) {
    (mine.has(item.malId) ? existing : fresh).push(item);
  }
  return { fresh, existing };
}

function importMapHtml() {
  const { fresh, existing } = splitImportItems();
  const byStatus = {};
  for (const item of importData.items) {
    const key = item.status || "—";
    byStatus[key] = (byStatus[key] || 0) + 1;
  }
  const scored = importData.items.filter((i) => i.score > 0).length;

  const statusRows = Object.keys(MAL_STATUS_KEYS)
    .filter((key) => byStatus[key])
    .map((key) => `
      <div class="imp-row">
        <div class="imp-from">${esc(MAL_STATUS_KEYS[key])} <span class="imp-count">${byStatus[key]}</span></div>
        <div class="imp-arrow">→</div>
        <select class="imp-select" data-status="${key}">
          <option value="">не импортировать</option>
          <option value="completed"${importStatusMap[key] === "completed" ? " selected" : ""}>${esc(siteLabel("statuses", "archive", "Архив"))}</option>
          ${activeStatusBuckets().map((b) =>
            `<option value="${esc(b.key)}"${importStatusMap[key] === b.key ? " selected" : ""}>${esc(b.label)}</option>`
          ).join("")}
        </select>
      </div>`).join("");

  const scoreRows = [];
  for (let score = 10; score >= 1; score--) {
    const n = importData.items.filter((i) => i.score === score).length;
    if (!n) continue;
    scoreRows.push(`
      <div class="imp-row">
        <div class="imp-from">${score} из 10 <span class="imp-count">${n}</span></div>
        <div class="imp-arrow">→</div>
        <select class="imp-select" data-score="${score}">
          <option value="">без оценки</option>
          ${GRADE_ORDER.map((key) =>
            `<option value="${esc(key)}"${importScoreMap[score] === key ? " selected" : ""}>${esc(GRADES[key]?.name || key)}</option>`
          ).join("")}
        </select>
      </div>`);
  }

  return `
    <div class="imp-summary">
      ${impStat(importData.items.length, "в выгрузке")}
      ${impStat(fresh.length, "новых")}
      ${impStat(existing.length, "уже есть")}
      ${impStat(scored, "с оценкой")}
    </div>
    ${importData.skipped ? `<p class="imp-note">${importData.skipped} записей пропущено — у них нет номера или названия.</p>` : ""}

    <h2 class="section-h">Статусы</h2>
    <p class="panel-intro">Слева то, что стоит в выгрузке, справа — куда это ляжет у тебя.</p>
    ${statusRows}

    <h2 class="section-h">Оценки</h2>
    <p class="panel-intro">
      Десятибалльная шкала на твои полки. Расставлено поровну — поправь, если
      у тебя другое представление о том, что такое «восьмёрка».
    </p>
    ${scoreRows.join("") || `<p class="imp-note">В выгрузке нет ни одной оценки.</p>`}

    <h2 class="section-h">Что уже есть в паспорте</h2>
    <div class="imp-row imp-row-plain">
      <label><input type="checkbox" id="imp-skip" ${importSkipExisting ? "checked" : ""}> Не трогать ${existing.length} записей, которые уже заведены</label>
    </div>
    <p class="panel-intro">
      Снятая галочка перезапишет у них статус и оценку значениями из выгрузки.
      Тексты отзывов не пострадают в любом случае.
    </p>

    <div class="imp-actions">
      <button class="btn-save" id="imp-run" type="button">Перенести в паспорт</button>
      <button class="btn btn-ghost" id="imp-cancel" type="button">Отмена</button>
    </div>
    <div class="status-msg" id="imp-status"></div>`;
}

function importDoneHtml() {
  return `
    <p class="panel-intro">Готово. Сайт обновится в течение минуты.</p>
    <div class="imp-summary">
      ${impStat(importData.added, "добавлено")}
      ${impStat(importData.updated, "обновлено")}
      ${impStat(importData.untouched, "не тронуто")}
    </div>
    <div class="imp-actions">
      <button class="btn btn-ghost" id="imp-again" type="button">Импортировать ещё файл</button>
    </div>`;
}

function impStat(value, label) {
  return `<div class="imp-stat">
    <div class="imp-stat-value">${value}</div>
    <div class="imp-stat-label">${esc(label)}</div>
  </div>`;
}

// ── Обложки и номера AniList ───────────────────
// В выгрузке их нет: MAL отдаёт только номер и название. Без обложки
// сотня импортированных карточек выглядит пустыми рамками, поэтому
// дозапрашиваем — тем же способом, что и scripts/enrich-ids.js, и так
// же без ключей. Не получилось — не беда, тайтлы всё равно переедут.

async function fetchAnilistMeta(malIds, onProgress) {
  const query = `
    query ($ids: [Int]) {
      Page(perPage: 50) {
        media(idMal_in: $ids) {
          id
          idMal
          coverImage { large }
          startDate { year }
        }
      }
    }`;

  const byMal = new Map();
  for (let i = 0; i < malIds.length; i += IMPORT_BATCH) {
    const chunk = malIds.slice(i, i + IMPORT_BATCH);
    onProgress?.(Math.min(i + chunk.length, malIds.length), malIds.length);
    try {
      const res = await fetch(IMPORT_ANILIST_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: { ids: chunk } }),
      });
      if (!res.ok) continue;
      const body = await res.json();
      for (const m of body?.data?.Page?.media || []) {
        if (m.idMal) byMal.set(m.idMal, m);
      }
    } catch {
      // Сеть отвалилась — идём дальше без обложек для этой пачки.
    }
    if (i + IMPORT_BATCH < malIds.length) await new Promise((r) => setTimeout(r, 1200));
  }
  return byMal;
}

// ── Перенос ────────────────────────────────────

async function runImport() {
  const status = document.getElementById("imp-status");
  const btn = document.getElementById("imp-run");
  btn.disabled = true;

  const { fresh, existing } = splitImportItems();
  const toWrite = importSkipExisting ? fresh : [...fresh, ...existing];

  // Не импортируем то, чей статус человек оставил пустым.
  const selected = toWrite.filter((i) => i.status && importStatusMap[i.status]);
  if (!selected.length) {
    status.className = "status-msg err";
    status.textContent = "Нечего переносить: у всех записей статус помечен как «не импортировать».";
    btn.disabled = false;
    return;
  }

  status.className = "status-msg";
  status.textContent = "Спрашиваем обложки у AniList…";
  const meta = await fetchAnilistMeta(
    selected.map((i) => i.malId),
    (done, total) => { status.textContent = `Спрашиваем обложки у AniList… ${done} из ${total}`; }
  );

  const payload = selected.map((item) => {
    const extra = meta.get(item.malId);
    const ids = { mal: item.malId };
    if (extra?.id) ids.anilist = extra.id;
    return {
      title: item.title,
      type: item.type,
      status: importStatusMap[item.status],
      grade: item.score ? importScoreMap[item.score] || null : null,
      year: extra?.startDate?.year ? String(extra.startDate.year) : null,
      cover: extra?.coverImage?.large || null,
      rewatch_count: item.rewatch || 0,
      date_start: item.dateStart,
      date_end: item.dateEnd,
      ids,
    };
  });

  status.textContent = `Записываем ${payload.length} тайтлов…`;
  try {
    const res = await fetch("/api/import-reviews", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: payload, overwrite: !importSkipExisting }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `Сервер ответил ${res.status}`);

    importData.added = data.added ?? 0;
    importData.updated = data.updated ?? 0;
    importData.untouched = importData.items.length - (data.added ?? 0) - (data.updated ?? 0);
    importStep = "done";
    cache.reviews = null; // список изменился — перечитаем при следующем обращении
    renderImport();
  } catch (err) {
    status.className = "status-msg err";
    status.textContent = `Не получилось: ${err.message}`;
    btn.disabled = false;
  }
}

function bindImport() {
  document.getElementById("imp-file")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const status = document.getElementById("imp-status");
    status.className = "status-msg";
    status.textContent = "Читаем файл…";
    try {
      importData = parseMalExport(await file.text());
      importStatusMap = defaultStatusMap();
      importScoreMap = defaultScoreMap();
      importStep = "map";
      renderImport();
    } catch (err) {
      status.className = "status-msg err";
      status.textContent = err.message;
    }
  });

  document.querySelectorAll("[data-status]").forEach((sel) => {
    sel.addEventListener("change", () => { importStatusMap[sel.dataset.status] = sel.value; });
  });
  document.querySelectorAll("[data-score]").forEach((sel) => {
    sel.addEventListener("change", () => { importScoreMap[sel.dataset.score] = sel.value; });
  });
  document.getElementById("imp-skip")?.addEventListener("change", (e) => {
    importSkipExisting = e.target.checked;
  });

  document.getElementById("imp-run")?.addEventListener("click", runImport);
  document.getElementById("imp-cancel")?.addEventListener("click", () => {
    importData = null;
    importStep = "file";
    renderImport();
  });
  document.getElementById("imp-again")?.addEventListener("click", () => {
    importData = null;
    importStep = "file";
    renderImport();
  });
}

function importStyles() {
  return `<style>
    .imp-actions { display: flex; flex-wrap: wrap; gap: .6rem; align-items: center; margin: 1.2rem 0 .6rem; }
    .imp-file-btn {
      font-family: 'DM Sans', sans-serif;
      font-size: .68rem; letter-spacing: .1em; text-transform: uppercase;
      color: var(--text-dim); background: var(--surface);
      border: 1px solid var(--border2); border-radius: 2px;
      padding: .5rem 1rem; cursor: pointer;
      transition: color .2s, border-color .2s;
    }
    .imp-file-btn:hover { color: var(--text-hi); border-color: var(--red-dim); }
    .imp-file-btn input { display: none; }

    .imp-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
      gap: 1px; background: var(--border);
      border: 1px solid var(--border); border-radius: 2px;
      overflow: hidden; margin-bottom: 1rem;
    }
    .imp-stat { background: var(--surface); padding: .85rem .7rem; text-align: center; }
    .imp-stat-value {
      font-family: 'Playfair Display', serif;
      font-weight: 700; font-size: 1.5rem; color: var(--text-hi); line-height: 1;
    }
    .imp-stat-label {
      font-family: 'DM Sans', sans-serif;
      font-size: .57rem; letter-spacing: .1em; text-transform: uppercase;
      color: var(--text-dim); margin-top: .4rem;
    }
    .imp-note {
      font-family: 'DM Sans', sans-serif;
      font-size: .75rem; color: var(--text-dim); margin: 0 0 1.5rem;
    }

    .imp-row {
      display: flex; align-items: center; gap: .7rem;
      padding: .5rem 0;
      border-bottom: 1px solid var(--border);
    }
    .imp-row-plain { border-bottom: none; }
    .imp-from {
      flex: 1; min-width: 0;
      font-family: 'Cormorant Garamond', serif;
      font-size: .98rem; color: var(--text-hi);
    }
    .imp-count {
      font-family: 'DM Sans', sans-serif;
      font-size: .62rem; color: var(--text-dim); margin-left: .4rem;
    }
    .imp-arrow { color: var(--text-dim); flex-shrink: 0; }
    .imp-select { width: auto; min-width: 11rem; flex-shrink: 0; }

    @media (max-width: 520px) {
      .imp-row { flex-wrap: wrap; }
      .imp-arrow { display: none; }
      .imp-select { width: 100%; min-width: 0; }
    }
  </style>`;
}
