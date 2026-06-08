// ══════════════════════════════════════════════
//  CARDS — переиспользуемые функции карточек
//  Зависит от: config.js
// ══════════════════════════════════════════════

// ── Хелперы ────────────────────────────────────
function normTitle(s) {
  return (s || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function findReviewForTitle(title, type) {
  if (!cache.reviews?.length || !title) return null;
  const norm = normTitle(title);
  const found = type
    ? cache.reviews.find(r => normTitle(r.title) === norm && r.type === type)
      ?? cache.reviews.find(r => normTitle(r.title) === norm)
    : cache.reviews.find(r => normTitle(r.title) === norm);
  if (!found) return null;
  const grade = GRADES[found.grade] || null;
  const score = gradeScore(found.grade);
  return grade ? { grade, score } : null;
}

function gradeInlineHtml(info) {
  if (!info) return "";
  return `<span class="card-grade-inline" style="color:${info.grade.color}">${esc(info.grade.name)}</span>`;
}

function fmtDateStr(str) {
  if (!str) return null;
  const d = new Date(str);
  if (isNaN(d)) return null;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// ── Все типы на русском ─────────────────────────
const TYPE_LABELS = {
  anime:   "Аниме",
  manga:   "Манга",
  manhwa:  "Манхва",
  manhua:  "Маньхуа",
  novel:   "Ранобэ",
  movie:   "Фильм",
  show:    "Сериал",
  dorama:  "Дорама",
  book:    "Книга",
  game:    "Игра",
  gacha:   "Гача",
  vn:      "Визуальная новелла",
};

// ── Карточки ───────────────────────────────────

// Тег в отзыве
function tagHtml(tag) {
  const info = TAGS_MAP[tag];
  const cls  = info ? TAG_CAT_CLASS[info.cat] : "rtag-special";
  const tip  = info?.tip || "";
  return `<span class="rtag ${cls}" data-tip="${esc(tip)}">${esc(tag)}</span>`;
}

// Карточка из reviews.json (главная, архив)
function manualCard(r, index) {
  const info     = findReviewForTitle(r.title, r.type);
  const tagLabel = TYPE_LABELS[r.type] || r.type || "—";

  let watchBadge = "";
  if (r.status === "current" && r.date_start) {
    const s = fmtDateStr(r.date_start);
    if (s) watchBadge = `с ${s}`;
  } else if (r.status === "completed") {
    const startStr = r.date_start ? fmtDateStr(r.date_start) : null;
    const endStr   = r.date_end   ? fmtDateStr(r.date_end)   : null;
    if (endStr && startStr && r.date_start !== r.date_end) {
      watchBadge = `${startStr} → ${endStr}`;
    } else if (endStr) {
      watchBadge = endStr;
    } else if (startStr) {
      watchBadge = startStr;
    }
  }

  const editId = r.id ?? encodeURIComponent(r.title);
  const pencil = (document.cookie.split(";").some(c => c.trim().startsWith("tasteid_ui=")))
    ? `<a href="add.html?edit=${editId}" class="review-edit-btn" title="Редактировать">✎</a>`
    : "";

  return `<div class="review-card-wrap" style="animation-delay:${Math.min(index * 25, 600)}ms">
    ${pencil}
    <a href="${esc(r.url || "#")}" target="_blank" rel="noopener" class="card" style="animation-delay:0ms">
      <span class="type-tag tag-manual">${esc(tagLabel)}</span>
      ${watchBadge ? `<span class="watch-badge">${esc(watchBadge)}</span>` : ""}
      <img src="${esc(r.cover || PH_TALL)}" alt="${esc(r.title)}" loading="lazy" onerror="this.src='${PH_TALL}'">
      <div class="card-body">
        <div class="card-title">${esc(r.title)}</div>
        ${r.year || info
          ? `<div class="card-meta">
              ${r.year ? `<span>${esc(String(r.year))}</span>` : ""}
              ${gradeInlineHtml(info)}
            </div>`
          : ""}
      </div>
    </a>
  </div>`;
}
