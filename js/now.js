// ══════════════════════════════════════════════
//  NOW — вкладка Главная
//  Зависит от: config.js, api.js, cards.js
// ══════════════════════════════════════════════

const NOW_QUERY = `
query($name: String) {
  anime_cur: Page(perPage: 50) {
    mediaList(userName: $name, type: ANIME, status: CURRENT, sort: UPDATED_TIME_DESC) {
      progress
      media {
        id siteUrl type format episodes
        title { userPreferred romaji }
        coverImage { extraLarge large }
        startDate { year }
      }
    }
  }
  manga_cur: Page(perPage: 50) {
    mediaList(userName: $name, type: MANGA, status: CURRENT, sort: UPDATED_TIME_DESC) {
      progress
      media {
        id siteUrl type format chapters volumes
        title { userPreferred romaji }
        coverImage { extraLarge large }
        startDate { year }
      }
    }
  }
  anime_plan: Page(perPage: 50) {
    mediaList(userName: $name, type: ANIME, status: PLANNING, sort: UPDATED_TIME_DESC) {
      media {
        id siteUrl type format episodes
        title { userPreferred romaji }
        coverImage { extraLarge large }
        startDate { year }
      }
    }
  }
  manga_plan: Page(perPage: 50) {
    mediaList(userName: $name, type: MANGA, status: PLANNING, sort: UPDATED_TIME_DESC) {
      media {
        id siteUrl type format chapters
        title { userPreferred romaji }
        coverImage { extraLarge large }
        startDate { year }
      }
    }
  }
  anime_done: Page(perPage: 50) {
    mediaList(userName: $name, type: ANIME, status: COMPLETED, sort: UPDATED_TIME_DESC) {
      startedAt   { year month day }
      completedAt { year month day }
      media {
        id siteUrl type format
        title { userPreferred romaji }
        coverImage { extraLarge large }
        startDate { year }
      }
    }
  }
  manga_done: Page(perPage: 50) {
    mediaList(userName: $name, type: MANGA, status: COMPLETED, sort: UPDATED_TIME_DESC) {
      startedAt   { year month day }
      completedAt { year month day }
      media {
        id siteUrl type format
        title { userPreferred romaji }
        coverImage { extraLarge large }
        startDate { year }
      }
    }
  }
}`;

// Флаг — чтобы не запускать загрузку дважды одновременно
const loading = {};

async function loadNow() {
  if (cache.now)   { renderNow(cache.now); return; }
  if (loading.now) return;
  loading.now = true;

  await fetchReviews();

  try {
    const [alData, traktMoviesRaw, traktShowsRaw, traktWlMoviesRaw, traktWlShowsRaw, hardcoverBooks] = await Promise.all([
      gql(NOW_QUERY, { name: AL_USERNAME }),
      fetchTraktWatched("movie"),
      fetchTraktWatched("show"),
      fetchTraktWatchlist("movie"),
      fetchTraktWatchlist("show"),
      fetchHardcoverBooks()
    ]);

    const alCurrent = [
      ...(alData.anime_cur?.mediaList || []),
      ...(alData.manga_cur?.mediaList  || [])
    ];
    const alPlanning = [
      ...(alData.anime_plan?.mediaList || []),
      ...(alData.manga_plan?.mediaList  || [])
    ];
    const alCompleted = [
      ...(alData.anime_done?.mediaList || []),
      ...(alData.manga_done?.mediaList  || [])
    ];

    const [enrichedMovies, enrichedShows, enrichedWlMovies, enrichedWlShows] = await Promise.all([
      enrichTraktWithPosters(traktMoviesRaw.slice(0, 50), "movie"),
      enrichTraktWithPosters(traktShowsRaw.slice(0,  50), "show"),
      enrichTraktWithPosters(traktWlMoviesRaw.slice(0, 50), "movie"),
      enrichTraktWithPosters(traktWlShowsRaw.slice(0,  50), "show")
    ]);

    // Ручные записи: игры и прочее из reviews.json
    // Фильтруем всё что не anime/manga/novel/movie/show
    const allManual = (cache.reviews || []).filter(
      r => !["anime", "manga", "novel", "movie", "show"].includes(r.type)
    );

    // Разделяем по полю status (с обратной совместимостью для старых записей без status)
    const manualPlanning  = allManual.filter(r => r.status === "planning");
    const manualCurrent   = allManual.filter(r => r.status === "current");
    const manualCompleted = allManual.filter(r =>
      r.status === "completed" || (!r.status && (r.preview || r.grade))
    );

    const booksCurrent   = hardcoverBooks.filter(b => b.status_id === 2);
    const booksPlanning  = hardcoverBooks.filter(b => b.status_id === 1);
    const booksCompleted = hardcoverBooks.filter(b => b.status_id === 3);

    cache.now = {
      alCurrent,
      alPlanning,
      alCompleted,
      traktMovies:    enrichedMovies,
      traktShows:     enrichedShows,
      traktWlMovies:  enrichedWlMovies,
      traktWlShows:   enrichedWlShows,
      manualPlanning,
      manualCurrent,
      manualCompleted,
      booksCurrent,
      booksPlanning,
      booksCompleted
    };
    renderNow(cache.now);

  } catch (err) {
    document.getElementById("tab-now").innerHTML =
      `<div class="state-box">
        <div style="font-size:2rem;margin-bottom:.75rem">⚠️</div>
        Ошибка: ${esc(err.message)}
      </div>`;
  } finally {
    loading.now = false;
  }
}

function renderNow({
  alCurrent, alPlanning, alCompleted,
  traktMovies, traktShows,
  traktWlMovies, traktWlShows,
  manualPlanning = [], manualCurrent = [], manualCompleted = [],
  booksCurrent = [], booksPlanning = [], booksCompleted = []
}) {
  const box = document.getElementById("tab-now");
  let html  = "";

  // ── В процессе ─────────────────────────────────
  const inProgress = [
    ...alCurrent.map((e, i) => nowCard(e, i)),
    ...booksCurrent.map((b, i) => bookCard(b, alCurrent.length + i, "current")),
    ...manualCurrent.map((r, i) => manualCard(r, alCurrent.length + booksCurrent.length + i))
  ];
  if (inProgress.length) {
    html += `<section class="group">
      <h2 class="section-title">В процессе</h2>
      <div class="grid-now">${inProgress.join("")}</div>
    </section>`;
  }

  // ── Планирую ───────────────────────────────────
  const planning = [
    ...alPlanning.map((e, i) => planCard(e, i)),
    ...traktWlMovies.map((e, i) => traktCard(e, "movie", alPlanning.length + i)),
    ...traktWlShows.map((e, i)  => traktCard(e, "show",  alPlanning.length + traktWlMovies.length + i)),
    ...booksPlanning.map((b, i) => bookCard(b, alPlanning.length + traktWlMovies.length + traktWlShows.length + i, "planning")),
    ...manualPlanning.map((r, i) => manualCard(r, alPlanning.length + traktWlMovies.length + traktWlShows.length + booksPlanning.length + i))
  ];
  if (planning.length) {
    html += `<section class="group">
      <h2 class="section-title">Планирую</h2>
      <div class="grid-now">${planning.join("")}</div>
    </section>`;
  }

  // ── Архив ──────────────────────────────────────
  const allCompleted = [
    ...alCompleted.map(e => {
      const c = e.completedAt;
      const sortDate = c?.year
        ? new Date(c.year, (c.month || 1) - 1, c.day || 1)
        : new Date(0);
      return { _src: "al", data: e, _sortDate: sortDate, _sortYear: c?.year || 0 };
    }),
    ...traktMovies.map(e => {
      const d = e.last_watched_at ? new Date(e.last_watched_at) : new Date(0);
      return { _src: "trakt", type: "movie", data: e, _sortDate: d, _sortYear: d.getFullYear() || 0 };
    }),
    ...traktShows.map(e => {
      const d = e.last_watched_at ? new Date(e.last_watched_at) : new Date(0);
      return { _src: "trakt", type: "show",  data: e, _sortDate: d, _sortYear: d.getFullYear() || 0 };
    }),
    ...manualCompleted.map(e => {
      const d = e.date ? new Date(e.date) : new Date(0);
      return { _src: "manual", data: e, _sortDate: d, _sortYear: d.getFullYear() || 0 };
    }),
    ...booksCompleted.map(b => {
      const reads    = b.user_book_reads || [];
      const finished = reads[reads.length - 1]?.finished_at;
      const d        = finished ? new Date(finished) : (b.updated_at ? new Date(b.updated_at) : new Date(0));
      return { _src: "book", data: b, _sortDate: d, _sortYear: d.getFullYear() || 0 };
    })
  ];
  allCompleted.sort((a, b) => b._sortDate - a._sortDate);

  if (allCompleted.length) {
    const byYear = {};
    for (const item of allCompleted) {
      const y = item._sortYear || "—";
      if (!byYear[y]) byYear[y] = [];
      byYear[y].push(item);
    }

    let completedHtml = "";
    for (const year of Object.keys(byYear).sort((a, b) => b - a)) {
      completedHtml += `<div class="year-divider">${esc(String(year))}</div>
        <div class="grid-now">
          ${byYear[year].map((item, i) => {
            if (item._src === "al")     return completedCard(item.data, i);
            if (item._src === "manual") return manualCard(item.data, i);
            if (item._src === "book")   return bookCard(item.data, i, "completed");
            return traktCard(item.data, item.type, i);
          }).join("")}
        </div>`;
    }

    html += `<section class="group">
      <h2 class="section-title">Архив</h2>
      ${completedHtml}
    </section>`;
  }

  box.innerHTML = html || `<div class="state-box">Список пуст</div>`;
}

// Карточка планируемого аниме/манги (AniList PLANNING)
// Без дат и прогресса — просто обложка и название
function planCard(entry, index) {
  const m = entry.media;
  const img = coverUrl(m.coverImage);
  const t   = mediaTitle(m.title);
  const [tagClass, tagLabel] = entryTypeTag(entry);
  const year = m.startDate?.year || "";

  return `<a href="${esc(m.siteUrl)}" target="_blank" rel="noopener" class="card"
      style="animation-delay:${Math.min(index * 25, 600)}ms">
    <span class="type-tag tag-${tagClass}">${esc(tagLabel)}</span>
    <img src="${esc(img)}" alt="${esc(t)}" loading="lazy" onerror="this.src='${PH_TALL}'">
    <div class="card-body">
      <div class="card-title">${esc(t)}</div>
      ${year ? `<div class="card-meta"><span>${esc(String(year))}</span></div>` : ""}
    </div>
  </a>`;
}
