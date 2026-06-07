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

function findReviewForTitle(title) {
  if (!cache.reviews?.length || !title) return null;
  const norm  = normTitle(title);
  const found = cache.reviews.find(r => normTitle(r.title) === norm);
  if (!found) return null;
  const grade = GRADES[found.grade] || null;
  const score = gradeScore(found.grade);
  return grade ? { grade, score } : null;
}

function gradeInlineHtml(info) {
  if (!info) return "";
  return `<span class="card-grade-inline" style="color:${info.grade.color}">${esc(info.grade.name)}</span>`;
}

function fmtDate(d) {
  if (!d?.year || !d?.month) return null;
  if (!d.day) return new Date(d.year, d.month - 1)
    .toLocaleDateString("ru-RU", { month: "short" });
  return new Date(d.year, d.month - 1, d.day)
    .toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function fmtDateStr(str) {
  if (!str) return null;
  const d = new Date(str);
  if (isNaN(d)) return null;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
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
  const year  = m.startDate?.year || "";

  return `<a href="${esc(m.siteUrl)}" target="_blank" rel="noopener" class="card"
      style="animation-delay:${Math.min(index * 25, 600)}ms">
    <span class="type-tag tag-${tagClass}">${esc(tagLabel)}</span>
    <img src="${esc(img)}" alt="${esc(t)}" loading="lazy" onerror="this.src='${PH_TALL}'">
    <div class="card-body">
      <div class="card-title">${esc(t)}</div>
      <div class="card-meta">
        <span class="progress-line">${done}${total ? " / " + total : ""} ${unit}</span>
        ${year ? `<span>${esc(String(year))}</span>` : ""}
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

  return `<a href="${esc(m.siteUrl)}" target="_blank" rel="noopener" class="card"
      style="animation-delay:${Math.min(index * 25, 600)}ms">
    <span class="type-tag tag-${tagClass}">${esc(tagLabel)}</span>
    ${watchBadge ? `<span class="watch-badge">${esc(watchBadge)}</span>` : ""}
    <img src="${esc(img)}" alt="${esc(t)}" loading="lazy" onerror="this.src='${PH_TALL}'">
    <div class="card-body">
      <div class="card-title">${esc(t)}</div>
      ${releaseYear || info
        ? `<div class="card-meta">
            ${releaseYear ? `<span>${esc(String(releaseYear))}</span>` : ""}
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

  return `<a href="${esc(url)}" target="_blank" rel="noopener" class="card"
      style="animation-delay:${Math.min(index * 25, 600)}ms">
    <span class="type-tag ${tagClass}">${esc(tagLabel)}</span>
    ${watchBadge ? `<span class="watch-badge">${esc(watchBadge)}</span>` : ""}
    <img src="${esc(poster)}" alt="${esc(title)}" loading="lazy" onerror="this.src='${PH_TALL}'">
    <div class="card-body">
      <div class="card-title">${esc(title)}</div>
      ${year || info
        ? `<div class="card-meta">
            ${year ? `<span>${esc(String(year))}</span>` : ""}
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
  return `<a href="${esc(item.siteUrl)}" target="_blank" rel="noopener"
      class="card card-char"
      style="animation-delay:${Math.min(index * 25, 500)}ms">
    <img src="${esc(img)}" alt="${esc(name)}" loading="lazy" onerror="this.src='${PH_SQ}'">
    <div class="card-body"><div class="card-title">${esc(name)}</div></div>
  </a>`;
}

// Тег в отзыве
function tagHtml(tag) {
  const info = TAGS_MAP[tag];
  const cls  = info ? TAG_CAT_CLASS[info.cat] : "rtag-special";
  const tip  = info?.tip || "";
  return `<span class="rtag ${cls}" data-tip="${esc(tip)}">${esc(tag)}</span>`;
}

// Игра / визуальная новелла / другие ручные записи из reviews.json
function manualCard(r, index) {
  const info = findReviewForTitle(r.title);
  const typeLabels = { game: "Игра", vn: "Визуальная новелла" };
  const tagLabel = typeLabels[r.type] || r.type || "—";

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

// Книга (Hardcover)
function bookCard(book, index, mode = "completed") {
  const b       = book.book || book;
  const title   = b.title || "—";
  const cover   = b.image?.url || PH_TALL;
  const year    = b.release_year || "";
  const url     = b.slug ? `https://hardcover.app/books/${b.slug}` : "#";
  const info    = findReviewForTitle(title);

  let watchBadge = "";
  if (mode === "completed") {
    const reads    = book.user_book_reads || [];
    const finished = reads[reads.length - 1]?.finished_at;
    if (finished) {
      const d = new Date(finished);
      watchBadge = d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
    }
  }

  let progressHtml = "";
  if (mode === "current") {
    const reads   = book.user_book_reads || [];
    const started = reads[reads.length - 1]?.started_at;
    if (started) {
      const d = new Date(started);
      progressHtml = `<span class="progress-line">с ${d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>`;
    }
  }

  return `<a href="${esc(url)}" target="_blank" rel="noopener" class="card"
      style="animation-delay:${Math.min(index * 25, 600)}ms">
    <span class="type-tag tag-book">Книга</span>
    ${watchBadge ? `<span class="watch-badge">${esc(watchBadge)}</span>` : ""}
    <img src="${esc(cover)}" alt="${esc(title)}" loading="lazy" onerror="this.src='${PH_TALL}'">
    <div class="card-body">
      <div class="card-title">${esc(title)}</div>
      ${progressHtml || year || info
        ? `<div class="card-meta">
            ${progressHtml || (year ? `<span>${esc(String(year))}</span>` : "")}
            ${gradeInlineHtml(info)}
          </div>`
        : ""}
    </div>
  </a>`;
}
