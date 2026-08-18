// ══════════════════════════════════════════════
//  COMPARE — вкладка Сравнение
//  Зависит от: config.js, api.js, cards.js, utils.js
//
//  Остальные вкладки отвечают на вопрос «что я думаю». Эта — на
//  «а что думает он»: два паспорта рядом, с упором на расхождения.
//  Совпадения предсказуемы и скучны, спор — нет.
//
//  Чужой паспорт приходит файлом: человек выгружает свой отсюда же
//  и передаёт как хочет. Отдельного сервера для этого не нужно,
//  сравнение целиком считается в браузере. Когда появится обмен по
//  коду, поменяется только способ доставки файла — формат и вся
//  математика ниже останутся теми же.
// ══════════════════════════════════════════════

const PASSPORT_FORMAT = "tasteid-passport";
const PASSPORT_VERSION = 1;
const GUEST_KEY = "tasteid_guest_passport";

// Насколько далеко должны разойтись оценки, чтобы считать это спором.
// Меряется в долях шкалы (0 — та же полка, 1 — с лучшей на худшую),
// поэтому порог не зависит от того, семь у человека полок или сто.
const DISAGREE_THRESHOLD = 0.2;

let guestPassport = null;

// ── Формат паспорта ────────────────────────────
// Только то, что нужно для сравнения: тексты отзывов и служебные поля
// не нужны, а вес файла и приватность экономят.

function buildMyPassport() {
  const scale = window.SITE_GRADE_SCALE || {
    type: "categorical",
    shelves: GRADE_ORDER.map((key) => ({ key, name: GRADES[key]?.name || key, color: GRADES[key]?.color })),
  };

  const items = (cache.reviews || [])
    .filter((r) => gradeToShelf(r.grade) || r.favorite)
    .map((r) => ({
      title: r.title,
      type: r.type || null,
      year: r.year || null,
      cover: r.cover || r.cover_backup || null,
      grade: gradeToShelf(r.grade),
      favorite: r.favorite === true,
      ids: r.ids || undefined,
    }));

  return {
    format: PASSPORT_FORMAT,
    version: PASSPORT_VERSION,
    exportedAt: new Date().toISOString(),
    gradeScale: { type: scale.type, shelves: scale.shelves },
    items,
  };
}

function exportMyPassport() {
  const passport = buildMyPassport();
  const blob = new Blob([JSON.stringify(passport, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `passport-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Файл пришёл от другого человека — значит доверять его содержимому
// нельзя. Проверяем форму до того, как что-то из него показывать.
function parsePassport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Это не похоже на файл паспорта — внутри не JSON.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Внутри файла должен быть объект паспорта.");
  }
  if (data.format !== PASSPORT_FORMAT) {
    throw new Error("Файл не от TasteID — не тот формат.");
  }
  if (!Array.isArray(data.items)) {
    throw new Error("В паспорте нет списка тайтлов.");
  }
  const shelves = data.gradeScale?.shelves;
  if (!Array.isArray(shelves) || !shelves.length) {
    throw new Error("В паспорте нет шкалы оценок — сравнивать будет не с чем.");
  }
  return {
    ...data,
    items: data.items.filter((i) => i && typeof i.title === "string" && i.title.trim()),
  };
}

// ── Сопоставление тайтлов ──────────────────────
// Сначала по номерам в чужих базах (js/external-ids.js) — это
// единственный надёжный способ: названия у одного и того же тайтла
// пишут по-разному. Название остаётся запасным вариантом для записей,
// у которых номера ещё нет.

const ID_MATCH_ORDER = ["mal", "anilist", "tmdb", "igdb", "hardcover_edition"];

function matchKeys(item) {
  const keys = [];
  for (const base of ID_MATCH_ORDER) {
    const value = item.ids?.[base];
    if (value) keys.push(`${base}:${value}`);
  }
  keys.push(`t:${normTitle(item.title)}|${item.type || ""}`);
  return keys;
}

// Ключ, под которым оказалось больше одной записи, выбрасывается
// совсем. Живой пример: три «Jujutsu Kaisen» — манга, второй сезон и
// третий. Номера у них разные, и по номерам всё сходится правильно,
// а вот по названию с типом второй и третий сезоны неразличимы. Лучше
// не сопоставить вовсе, чем показать выдуманный спор с чужой оценкой
// не от того сезона.
function indexByKeys(items) {
  const index = new Map();
  const ambiguous = new Set();
  for (const item of items) {
    for (const key of matchKeys(item)) {
      if (index.has(key) && index.get(key) !== item) ambiguous.add(key);
      else index.set(key, item);
    }
  }
  for (const key of ambiguous) index.delete(key);
  return index;
}

// ── Оценки в общих единицах ────────────────────
// У двух людей шкалы могут быть разные: у одного семь именованных
// полок, у другого десятибалльная. Сравнивать ключи бессмысленно,
// поэтому каждая оценка переводится в положение на своей шкале:
// 0 — лучшее, 1 — худшее. Дальше сравнимо что угодно с чем угодно.

function makeGradeInfo(scale) {
  const shelves = scale.shelves;
  const byKey = new Map(shelves.map((s, i) => [s.key, { ...s, index: i }]));
  const last = Math.max(shelves.length - 1, 1);
  return {
    label: (key) => byKey.get(key)?.name || key || "—",
    color: (key) => byKey.get(key)?.color || "var(--text-dim)",
    position: (key) => {
      const shelf = byKey.get(key);
      return shelf ? shelf.index / last : null;
    },
  };
}

function myGradeInfo() {
  return makeGradeInfo({
    shelves: GRADE_ORDER.map((key) => ({
      key,
      name: GRADES[key]?.name || key,
      color: GRADES[key]?.color,
    })),
  });
}

// ── Загрузка вкладки ───────────────────────────

async function loadCompare() {
  if (loading.compare) return;
  loading.compare = true;
  const box = document.getElementById("tab-compare");
  try {
    await fetchReviews();
    if (!guestPassport) {
      const saved = localStorage.getItem(GUEST_KEY);
      if (saved) {
        try {
          guestPassport = parsePassport(saved);
        } catch {
          // Сохранённый паспорт испортился или устарел форматом —
          // молча забываем, человек просто загрузит файл заново.
          localStorage.removeItem(GUEST_KEY);
        }
      }
    }
    renderCompare();
  } catch (err) {
    box.innerHTML = `<div class="state-box">Ошибка: ${esc(err.message)}</div>`;
  } finally {
    loading.compare = false;
  }
}

function compareIntroHtml() {
  return `
    <div class="cmp-intro">
      <p class="cmp-intro-text">
        Сравнение двух паспортов: что смотрели оба, где разошлись в оценках
        и что стоит забрать себе. Чужой паспорт — файл: пусть человек
        выгрузит свой такой же кнопкой ниже и пришлёт.
      </p>
      <div class="cmp-actions">
        <label class="cmp-file-btn">
          <input type="file" id="cmp-file" accept="application/json,.json">
          <span>Загрузить чужой паспорт</span>
        </label>
        <button class="cmp-btn" id="cmp-export">Выгрузить свой</button>
      </div>
      <div class="status-msg" id="cmp-status"></div>
    </div>`;
}

function renderCompare() {
  const box = document.getElementById("tab-compare");
  box.innerHTML = compareStyles() + compareIntroHtml() +
    (guestPassport ? compareResultHtml() : "");
  bindCompare();
}

function compareResultHtml() {
  const mine = myGradeInfo();
  const theirs = makeGradeInfo(guestPassport.gradeScale);

  const myItems = (cache.reviews || [])
    .filter((r) => gradeToShelf(r.grade))
    .map((r) => ({
      title: r.title,
      type: r.type || null,
      year: r.year || null,
      cover: r.cover || null,
      coverBackup: r.cover_backup || null,
      grade: gradeToShelf(r.grade),
      ids: r.ids,
    }));

  const theirItems = guestPassport.items.filter((i) => i.grade);
  const theirIndex = indexByKeys(theirItems);

  // Каждый чужой тайтл засчитывается не больше одного раза: без этого
  // два моих отзыва, севших на одну чужую запись, раздували бы «смотрели
  // оба» до числа большего, чем весь чужой паспорт.
  const claimed = new Set();
  const both = [];
  const onlyMine = [];
  for (const item of myItems) {
    const match = matchKeys(item)
      .map((k) => theirIndex.get(k))
      .find((m) => m && !claimed.has(m));
    if (match) {
      claimed.add(match);
      both.push({ mine: item, theirs: match });
    } else {
      onlyMine.push(item);
    }
  }
  const onlyTheirs = theirItems.filter((item) => !claimed.has(item));

  // Расхождение считаем в долях шкалы, чтобы разные шкалы были сравнимы.
  for (const pair of both) {
    const a = mine.position(pair.mine.grade);
    const b = theirs.position(pair.theirs.grade);
    pair.gap = a === null || b === null ? null : Math.abs(a - b);
    pair.iRatedHigher = a !== null && b !== null && a < b;
  }

  const rated = both.filter((p) => p.gap !== null);
  const argued = rated.filter((p) => p.gap > DISAGREE_THRESHOLD)
    .sort((a, b) => b.gap - a.gap);
  const agreed = rated.filter((p) => p.gap <= DISAGREE_THRESHOLD)
    .sort((a, b) => a.gap - b.gap);

  const avgGap = rated.length
    ? rated.reduce((sum, p) => sum + p.gap, 0) / rated.length
    : null;

  return `
    ${compareSummaryHtml(both.length, argued.length, avgGap, onlyTheirs.length)}
    ${compareSectionHtml(
      "Где разошлись",
      "Самое интересное место: чем выше, тем сильнее спор.",
      argued, mine, theirs, "Полное согласие — спорить не о чем."
    )}
    ${compareSectionHtml(
      "Где сошлись",
      "Одна и та же полка или соседние.",
      agreed, mine, theirs, "Общих оценок не нашлось."
    )}
    ${compareOneSidedHtml(
      "Стоит забрать себе",
      "Он оценил, а у тебя этого нет.",
      onlyTheirs, theirs
    )}
    ${compareOneSidedHtml(
      "Только у тебя",
      "Ты оценил, а у него этого нет.",
      onlyMine, mine
    )}`;
}

function compareSummaryHtml(overlap, argued, avgGap, theirOnly) {
  // Согласие как процент: 0 расхождения — 100%, полярные оценки — 0%.
  const accord = avgGap === null ? null : Math.round((1 - avgGap) * 100);
  const cell = (value, label) => `
    <div class="cmp-stat">
      <div class="cmp-stat-value">${value}</div>
      <div class="cmp-stat-label">${esc(label)}</div>
    </div>`;

  return `<div class="cmp-summary">
    ${cell(overlap, "смотрели оба")}
    ${cell(accord === null ? "—" : accord + "%", "совпадение вкусов")}
    ${cell(argued, "заметных споров")}
    ${cell(theirOnly, "можно забрать себе")}
  </div>`;
}

function cmpPosterHtml(item) {
  const cover = item.cover || item.coverBackup || PH_TALL;
  return `<img class="cmp-poster" src="${esc(cover)}" alt="" loading="lazy"
    ${imgFallbackAttrs(item.cover, item.coverBackup, PH_TALL)}>`;
}

function cmpMetaHtml(item) {
  const parts = [];
  if (item.type) parts.push(TYPE_LABELS[item.type] || item.type);
  if (item.year) parts.push(String(item.year));
  return parts.length ? `<div class="cmp-meta">${esc(parts.join(" · "))}</div>` : "";
}

function cmpChip(info, grade) {
  const color = info.color(grade);
  return `<span class="cmp-chip" style="--chip:${esc(color)}">${esc(info.label(grade))}</span>`;
}

function compareSectionHtml(title, sub, pairs, mine, theirs, emptyText) {
  const rows = pairs.map((pair) => `
    <div class="cmp-row${pair.gap > DISAGREE_THRESHOLD ? " cmp-row-argued" : ""}">
      ${cmpPosterHtml(pair.mine)}
      <div class="cmp-body">
        <div class="cmp-title">${esc(pair.mine.title)}</div>
        ${cmpMetaHtml(pair.mine)}
      </div>
      <div class="cmp-grades">
        <div class="cmp-side">
          <div class="cmp-side-who">ты</div>
          ${cmpChip(mine, pair.mine.grade)}
        </div>
        <div class="cmp-vs">${pair.gap > DISAGREE_THRESHOLD ? (pair.iRatedHigher ? "&gt;" : "&lt;") : "="}</div>
        <div class="cmp-side">
          <div class="cmp-side-who">он</div>
          ${cmpChip(theirs, pair.theirs.grade)}
        </div>
      </div>
    </div>`).join("");

  return `<section class="group cmp-section">
    <h2 class="section-title">${esc(title)}</h2>
    <p class="cmp-sub">${esc(sub)}</p>
    ${rows || `<div class="state-box" style="padding:1.5rem 1rem;font-size:.92rem">${esc(emptyText)}</div>`}
  </section>`;
}

function compareOneSidedHtml(title, sub, items, info) {
  // Сначала то, что оценено выше: если это список «забрать себе»,
  // сверху должно оказаться лучшее, а не случайное.
  const sorted = [...items].sort((a, b) => {
    const pa = info.position(a.grade);
    const pb = info.position(b.grade);
    return (pa === null ? 2 : pa) - (pb === null ? 2 : pb);
  });

  const rows = sorted.map((item) => `
    <div class="cmp-row">
      ${cmpPosterHtml(item)}
      <div class="cmp-body">
        <div class="cmp-title">${esc(item.title)}</div>
        ${cmpMetaHtml(item)}
      </div>
      <div class="cmp-grades cmp-grades-single">
        ${item.grade ? cmpChip(info, item.grade) : ""}
      </div>
    </div>`).join("");

  return `<section class="group cmp-section">
    <h2 class="section-title">${esc(title)}</h2>
    <p class="cmp-sub">${esc(sub)}</p>
    ${rows || `<div class="state-box" style="padding:1.5rem 1rem;font-size:.92rem">Пусто</div>`}
  </section>`;
}

function bindCompare() {
  document.getElementById("cmp-export")?.addEventListener("click", exportMyPassport);

  document.getElementById("cmp-file")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const status = document.getElementById("cmp-status");
    status.className = "status-msg";
    status.textContent = "Читаем файл…";
    try {
      const text = await file.text();
      guestPassport = parsePassport(text);
      try {
        localStorage.setItem(GUEST_KEY, text);
      } catch {
        // Паспорт не поместился в хранилище браузера — не беда,
        // сравнение всё равно покажем, просто до перезагрузки.
      }
      renderCompare();
    } catch (err) {
      status.className = "status-msg err";
      status.textContent = err.message;
    }
  });
}

function compareStyles() {
  return `<style>
    .cmp-intro { margin-bottom: 2.5rem; }
    .cmp-intro-text {
      font-family: 'Cormorant Garamond', serif;
      font-size: 1.05rem;
      color: var(--text);
      max-width: 60ch;
      margin: 0 0 1.2rem;
      line-height: 1.6;
    }
    .cmp-actions { display: flex; flex-wrap: wrap; gap: .6rem; align-items: center; }
    .cmp-file-btn, .cmp-btn {
      font-family: 'DM Sans', sans-serif;
      font-size: .68rem;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: var(--text-dim);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 2px;
      padding: .5rem 1rem;
      cursor: pointer;
      transition: color .2s, border-color .2s, background .2s;
    }
    .cmp-file-btn:hover, .cmp-btn:hover { color: var(--text-hi); border-color: var(--red-dim); }
    .cmp-file-btn input { display: none; }

    .cmp-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
      gap: 1px;
      background: var(--border);
      border: 1px solid var(--border);
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 3rem;
    }
    .cmp-stat { background: var(--surface); padding: 1rem .9rem; text-align: center; }
    .cmp-stat-value {
      font-family: 'Playfair Display', serif;
      font-weight: 700;
      font-size: 1.7rem;
      color: var(--text-hi);
      line-height: 1;
    }
    .cmp-stat-label {
      font-family: 'DM Sans', sans-serif;
      font-size: .6rem;
      letter-spacing: .1em;
      text-transform: uppercase;
      color: var(--text-dim);
      margin-top: .45rem;
    }

    .cmp-section { margin-bottom: 3rem; }
    .cmp-sub {
      font-family: 'DM Sans', sans-serif;
      font-size: .72rem;
      color: var(--text-dim);
      margin: -.6rem 0 1.2rem;
    }

    .cmp-row {
      display: flex;
      align-items: center;
      gap: .9rem;
      padding: .6rem .8rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 2px;
      margin-bottom: .5rem;
    }
    .cmp-row-argued { border-left: 3px solid var(--red); }

    .cmp-poster {
      width: 40px;
      aspect-ratio: 2/3;
      object-fit: cover;
      border-radius: 1px;
      flex-shrink: 0;
      background: var(--surface2);
    }
    .cmp-body { flex: 1; min-width: 0; }
    .cmp-title {
      font-family: 'Cormorant Garamond', serif;
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-hi);
      line-height: 1.3;
    }
    .cmp-meta {
      font-family: 'DM Sans', sans-serif;
      font-size: .62rem;
      letter-spacing: .06em;
      text-transform: uppercase;
      color: var(--text-dim);
      margin-top: .2rem;
    }

    .cmp-grades { display: flex; align-items: center; gap: .7rem; flex-shrink: 0; }
    .cmp-grades-single { min-width: 0; }
    .cmp-side { text-align: center; }
    .cmp-side-who {
      font-family: 'DM Sans', sans-serif;
      font-size: .55rem;
      letter-spacing: .12em;
      text-transform: uppercase;
      color: var(--text-dim);
      margin-bottom: .25rem;
    }
    .cmp-chip {
      display: inline-block;
      font-family: 'DM Sans', sans-serif;
      font-size: .63rem;
      letter-spacing: .04em;
      padding: .22rem .6rem;
      border-radius: 2px;
      white-space: nowrap;
      color: var(--chip);
      border: 1px solid var(--chip);
      background: color-mix(in srgb, var(--chip) 12%, transparent);
    }
    .cmp-vs {
      font-family: 'Playfair Display', serif;
      font-size: 1rem;
      color: var(--text-dim);
      flex-shrink: 0;
    }

    @media (max-width: 620px) {
      .cmp-row { flex-wrap: wrap; }
      .cmp-body { flex: 1 1 60%; }
      .cmp-grades { width: 100%; justify-content: flex-start; padding-left: 3.9rem; }
    }
  </style>`;
}
