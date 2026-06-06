// ══════════════════════════════════════════════
//  CARDS — переиспользуемые функции карточек
//  Зависит от: config.js
// ══════════════════════════════════════════════

// ── Хелперы ────────────────────────────────────
function coverUrl(img, sq = false) {
  if (!img) return sq ? PH_SQ : PH_TALL;
  return img.extraLarge || img.large || img.medium || (sq ? PH_SQ : PH_TALL);
}

function mediaTitle(t) {
  return t?.userPreferred || t?.romaji || t?.english || "—";
}

function entryTypeTag(entry) {
  if (entry.media.type === "ANIME") return ["anime", "Аниме"];
  if (NOVEL_FORMATS.includes(entry.media.format)) return ["novel", "Ранобе"];
  return ["manga", "Манга"];
}

function normTitle(s) {
  return (s || "").toLowerCase().trim().replace(/\s+/g, " ");
}

// Ищет отзыв по названию тайтла, возвращает { grade, score } или null
function findReviewForTitle(title) {
  if (!cache.reviews?.length || !title) return null;
  const norm  = normTitle(title);
  const found = cache.reviews.find(r => normTitle(r.title) === norm);
  if (!found) return null;
  const grade = GRADES[found.grade] || null;
  const score = gradeScore(found.grade);
  return grade ? { grade, score } : null;
}

// Инлайн-плашка оценки внутри карточки
function gradeInlineHtml(info) {
  if (!info) return "";
  return `<span class="card-grade-inline" style="color:${info.grade.color}">${info.grade.name}</span>`;
}

function fmtDate(d) {
  if (!d?.year || !d?.month) return null;
  if (!d.day) return new Date(d.year, d.month - 1)
    .toLocaleDateString("ru-RU", { month: "short" });
  return new Date(d.year, d.month - 1, d.day)
    .toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// ── Карточки ───────────────────────────────────

// Аниме/манга в процессе (AniList)
function nowCard(entry, index) {
  const m = entry.media;
  const img = coverUrl(m.coverImage);
  const t   = mediaTitle(m.title);
  const [tagClass, tagLabel] = entryTypeTag(entry);
  const done  = entry.progress ?? 0;
  const total = m.type === "ANIME" ? (m.episodes || 0) : (m.chapters || 0);
  const unit  = m.type === "ANIME" ? "эп." : "гл.";

  return `<a href="${m.siteUrl}" target="_blank" rel="noopener" class="card"
      style="animation-delay:${Math.min(index * 30, 600)}ms">
    <span class="type-tag tag-${tagClass}">${tagLabel}</span>
    <img src="${img}" alt="${t}" loading="lazy" onerror="this.src='${PH_TALL}'">
    <div class="card-body">
      <div class="card-title">${t}</div>
      <div class="card-meta">
        <span class="progress-line">${done}${total ? " / " + total : ""} ${unit}</span>
      </div>
    </div>
  </a>`;
}

// Аниме/манга просмотрено (AniList)
function completedCard(entry, index) {
  const m = entry.media;
  const img = coverUrl(m.coverImage);
  const t   = mediaTitle(m.title);
  const [tagClass, tagLabel] = entryTypeTag(entry);
  const s = entry.startedAt, c = entry.completedAt;

  let watchBadge = "";
  if (c?.year && c?.month) {
    const endStr   = fmtDate(c);
    const startStr = s?.month ? fmtDate(s) : null;
    const isSameDay = s?.year === c?.year && s?.month === c?.month && s?.day === c?.day;
    if (endStr) watchBadge = (startStr && !isSameDay) ? `${startStr} → ${endStr}` : endStr;
  }

  const releaseYear = m.startDate?.year || "";
  const info = findReviewForTitle(t);

  return `<a href="${m.siteUrl}" target="_blank" rel="noopener" class="card"
      style="animation-delay:${Math.min(index * 30, 600)}ms">
    <span class="type-tag tag-${tagClass}">${tagLabel}</span>
    ${watchBadge ? `<span class="watch-badge">${watchBadge}</span>` : ""}
    <img src="${img}" alt="${t}" loading="lazy" onerror="this.src='${PH_TALL}'">
    <div class="card-body">
      <div class="card-title">${t}</div>
      ${releaseYear || info
        ? `<div class="card-meta">
            ${releaseYear ? `<span>${releaseYear}</span>` : ""}
            ${gradeInlineHtml(info)}
          </div>`
        : ""}
    </div>
  </a>`;
}

// Фильм или сериал (Trakt + TMDb)
function traktCard(item, type, index) {
  const entry    = type === "movie" ? item.movie : item.show;
  const title    = item._title_ru || entry?.title || "—";
  const poster   = item._poster || PH_TALL;
  const year     = item._year || entry?.year || "";
  const url      = item._tmdb_url || "#";
  const tagClass = type === "movie" ? "tag-movie" : "tag-show";
  const tagLabel = type === "movie" ? "Фильм" : "Сериал";

  let watchBadge = "";
  if (item.last_watched_at) {
    const d = new Date(item.last_watched_at);
    watchBadge = d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  }

  const info = findReviewForTitle(title) || findReviewForTitle(entry?.title);

  return `<a href="${url}" target="_blank" rel="noopener" class="card"
      style="animation-delay:${Math.min(index * 20, 600)}ms">
    <span class="type-tag ${tagClass}">${tagLabel}</span>
    ${watchBadge ? `<span class="watch-badge">${watchBadge}</span>` : ""}
    <img src="${poster}" alt="${title}" loading="lazy" onerror="this.src='${PH_TALL}'">
    <div class="card-body">
      <div class="card-title">${title}</div>
      ${year || info
        ? `<div class="card-meta">
            ${year ? `<span>${year}</span>` : ""}
            ${gradeInlineHtml(info)}
          </div>`
        : ""}
    </div>
  </a>`;
}

// Персонаж или персона (квадратная карточка)
function personCard(item, index) {
  const name = item.name?.full || "—";
  const img  = item.image?.large || item.image?.medium || PH_SQ;
  return `<a href="${item.siteUrl}" target="_blank" rel="noopener"
      class="card card-char"
      style="animation-delay:${Math.min(index * 25, 500)}ms">
    <img src="${img}" alt="${name}" loading="lazy" onerror="this.src='${PH_SQ}'">
    <div class="card-body"><div class="card-title">${name}</div></div>
  </a>`;
}

// Тег в отзыве
function tagHtml(tag) {
  const info = TAGS_MAP[tag];
  const cls  = info ? TAG_CAT_CLASS[info.cat] : "rtag-special";
  const tip  = info?.tip || "";
  return `<span class="rtag ${cls}" data-tip="${tip}">${tag}</span>`;
}
function manualCard(r, index) {
  const info = findReviewForTitle(r.title);
  const typeLabels = { game: "Игра", vn: "Визуальная новелла" };
  const tagLabel = typeLabels[r.type] || r.type || "—";

  // дата из поля date
  let watchBadge = "";
  if (r.date) {
    const d = new Date(r.date);
    watchBadge = d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  }

  return `<a href="${r.url || "#"}" target="_blank" rel="noopener" class="card"
      style="animation-delay:${Math.min(index * 20, 600)}ms">
    <span class="type-tag tag-manual">${tagLabel}</span>
    ${watchBadge ? `<span class="watch-badge">${watchBadge}</span>` : ""}
    <img src="${r.cover || PH_TALL}" alt="${r.title}" loading="lazy" onerror="this.src='${PH_TALL}'">
    <div class="card-body">
      <div class="card-title">${r.title}</div>
      ${r.year || info
        ? `<div class="card-meta">
            ${r.year ? `<span>${r.year}</span>` : ""}
            ${gradeInlineHtml(info)}
          </div>`
        : ""}
    </div>
  </a>`;
}
