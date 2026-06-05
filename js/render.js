// ════════════════════════════════════════════════
// RENDER — All rendering functions
// ════════════════════════════════════════════════

const NOW_QUERY = `
query($name: String) {
  anime_cur: Page(perPage: 50) {
    mediaList(userName: $name, type: ANIME, status: CURRENT, sort: UPDATED_TIME_DESC) {
      progress
      media { id siteUrl type format title { userPreferred romaji } coverImage { extraLarge large } episodes startDate { year } }
    }
  }
  manga_cur: Page(perPage: 50) {
    mediaList(userName: $name, type: MANGA, status: CURRENT, sort: UPDATED_TIME_DESC) {
      progress
      media { id siteUrl type format title { userPreferred romaji } coverImage { extraLarge large } chapters volumes startDate { year } }
    }
  }
  anime_done: Page(perPage: 50) {
    mediaList(userName: $name, type: ANIME, status: COMPLETED, sort: UPDATED_TIME_DESC) {
      startedAt   { year month day }
      completedAt { year month day }
      media { id siteUrl type format title { userPreferred romaji } coverImage { extraLarge large } startDate { year } }
    }
  }
  manga_done: Page(perPage: 50) {
    mediaList(userName: $name, type: MANGA, status: COMPLETED, sort: UPDATED_TIME_DESC) {
      startedAt   { year month day }
      completedAt { year month day }
      media { id siteUrl type format title { userPreferred romaji } coverImage { extraLarge large } startDate { year } }
    }
  }
}`;

function nowCard(entry, i) {
  const [typeKey, typeLabel] = entryTypeTag(entry);
  const title = mediaTitle(entry.media.title);
  const review = findReviewForTitle(title);
  let progressHtml = "";
  if (entry.media.type === "ANIME") {
    const ep = entry.media.episodes || "?";
    progressHtml = `<span class="progress-line">${entry.progress}/${ep}</span>`;
  } else {
    const ch = entry.media.chapters || entry.media.volumes || "?";
    progressHtml = `<span class="progress-line">${entry.progress}/${ch}</span>`;
  }
  return `
    <a href="${entry.media.siteUrl}" target="_blank" class="card" style="--card-delay:${i*50}ms">
      <img src="${coverUrl(entry.media.coverImage)}" alt="${title}">
      <div class="type-tag tag-${typeKey}">${typeLabel}</div>
      ${review ? `<div class="watch-badge">${review.grade.name}</div>` : ""}
      <div class="card-body">
        <div class="card-title">${title}</div>
        <div class="card-meta">
          ${progressHtml}
          ${review ? gradeInlineHtml(review) : ""}
        </div>
      </div>
    </a>`;
}

function renderNow({ alCurrent, alCompleted, traktMovies, traktShows }) {
  const box = document.getElementById("tab-now");
  let html = "";

  if (alCurrent.length) {
    html += `<section class="group">
      <h2 class="section-title">В процессе</h2>
      <div class="grid-now">${alCurrent.map((e, i) => nowCard(e, i)).join("")}</div>
    </section>`;
  }

  const allCompleted = [
    ...alCompleted.map(e => {
      const c = e.completedAt;
      const sortDate = c?.year ? new Date(c.year, (c.month||1)-1, c.day||1) : new Date(0);
      return { _src:"al", data:e, _sortDate:sortDate, _sortYear:c?.year||0 };
    }),
    ...traktMovies.map((e,i) => ({ _src:"trakt-movie", data:e, _idx:i })),
    ...traktShows.map((e,i) => ({ _src:"trakt-show", data:e, _idx:i }))
  ].sort((a,b) => (b._sortDate||0) - (a._sortDate||0));

  if (allCompleted.length) {
    let lastYear = null;
    html += `<section class="group"><h2 class="section-title">Завершено</h2>`;
    for (const item of allCompleted) {
      const year = item._sortYear || (new Date((item.data._sortDate||new Date()).getTime()).getFullYear());
      if (year !== lastYear) { html += `<div class="year-divider">${year}</div>`; lastYear = year; }
      if (item._src === "al") {
        const e = item.data;
        const [typeKey, typeLabel] = entryTypeTag(e);
        const title = mediaTitle(e.media.title);
        const review = findReviewForTitle(title);
        html += `
          <a href="${e.media.siteUrl}" target="_blank" class="card">
            <img src="${coverUrl(e.media.coverImage)}" alt="${title}">
            <div class="type-tag tag-${typeKey}">${typeLabel}</div>
            ${review ? `<div class="watch-badge">${review.grade.name}</div>` : ""}
            <div class="card-body">
              <div class="card-title">${title}</div>
              <div class="card-meta">${review ? gradeInlineHtml(review) : ""}</div>
            </div>
          </a>`;
      } else {
        const e = item.data;
        const title = e._title_ru;
        const review = findReviewForTitle(title);
        const typeKey = e._type === "movie" ? "movie" : "show";
        const typeLabel = e._type === "movie" ? "Фильм" : "Сериал";
        html += `
          <a href="${e._tmdb_url || '#'}" target="_blank" class="card">
            <img src="${e._poster || PH_TALL}" alt="${title}">
            <div class="type-tag tag-${typeKey}">${typeLabel}</div>
            ${review ? `<div class="watch-badge">${review.grade.name}</div>` : ""}
            <div class="card-body">
              <div class="card-title">${title}</div>
              <div class="card-meta">
                <span class="progress-line">${e._year || "?"}</span>
                ${review ? gradeInlineHtml(review) : ""}
              </div>
            </div>
          </a>`;
      }
    }
    html += `</section>`;
  }

  box.innerHTML = html;
}

function renderFavorites({ characters, favorites }) {
  const box = document.getElementById("tab-favorites");
  let html = "";
  if (characters.length) {
    html += `<section class="group"><h2 class="section-title">Любимые персонажи</h2>
      <div class="grid-chars">${characters.map(c => `
        <a href="${c.siteUrl}" target="_blank" class="card card-char">
          <img src="${coverUrl(c.image, true)}" alt="${c.name}">
          <div class="card-body">
            <div class="card-title">${c.name}</div>
          </div>
        </a>`).join("")}</div>
    </section>`;
  }
  if (favorites.length) {
    html += `<section class="group"><h2 class="section-title">Любимое</h2>
      <div class="grid-now">${favorites.map((e, i) => `
        <a href="${e.media.siteUrl}" target="_blank" class="card" style="--card-delay:${i*50}ms">
          <img src="${coverUrl(e.media.coverImage)}" alt="${mediaTitle(e.media.title)}">
          <div class="type-tag tag-${entryTypeTag(e)[0]}">${entryTypeTag(e)[1]}</div>
          <div class="card-body">
            <div class="card-title">${mediaTitle(e.media.title)}</div>
          </div>
        </a>`).join("")}</div>
    </section>`;
  }
  box.innerHTML = html || `<div class="state-box">Пусто</div>`;
}

function renderReviews(reviews) {
  const box = document.getElementById("tab-reviews");
  if (!reviews.length) { box.innerHTML = `<div class="state-box">Отзывов нет</div>`; return; }
  let html = `<div class="reviews-grid">`;
  for (const r of reviews) {
    const grade = GRADES[r.grade] || {};
    const tagsHtml = (r.tags || []).map(tag => {
      const info = TAGS_MAP[tag];
      const cls = info ? TAG_CAT_CLASS[info.cat] : "rtag-special";
      return `<span class="rtag ${cls}" data-tip="${info?.tip || ""}">${tag}</span>`;
    }).join("");
    const sourceHtml = r.source ? `<a href="${r.source}" target="_blank" class="review-source-link"><span class="review-source-dot" style="background:${grade.color}"></span>${SOURCE_LABELS[r.source_type] || "Ссылка"}</a>` : "";
    html += `<div class="review-card">
      <div class="review-top">
        <div class="review-cover"><img src="${r.poster || PH_TALL}" alt="${r.title}"></div>
        <div class="review-body">
          <div class="review-header">
            <div class="review-title">${r.title}</div>
            <div class="review-meta-row">
              <span class="review-format">${r.format || "?"}</span>
              <span class="review-date">${new Date(r.date).toLocaleDateString('ru-RU')}</span>
            </div>
          </div>
          ${r.fav ? `<div class="review-waifu">💜 <span>${r.fav}</span></div>` : ""}
          <div class="review-preview">${r.preview || ""}</div>
        </div>
      </div>
      ${tagsHtml ? `<div class="review-tags">${tagsHtml}</div>` : ""}
      <div class="review-grade-bar">
        <div class="grade-square" style="background:${grade.color}"></div>
        <div class="grade-name">${grade.name || "?"}</div>
        <div class="grade-desc">${grade.desc || ""}</div>
        ${sourceHtml}
      </div>
    </div>`;
  }
  html += `</div>`;
  box.innerHTML = html;
}
