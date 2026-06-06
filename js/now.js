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

async function loadNow() {
  if (cache.now) { renderNow(cache.now); return; }

  // Предзагружаем отзывы чтобы показывать оценки на карточках
  await fetchReviews();

  try {
    const [alData, traktMoviesRaw, traktShowsRaw] = await Promise.all([
      gql(NOW_QUERY, { name: AL_USERNAME }),
      fetchTraktWatched("movie"),
      fetchTraktWatched("show")
    ]);

    const alCurrent = [
      ...(alData.anime_cur?.mediaList || []),
      ...(alData.manga_cur?.mediaList  || [])
    ];
    const alCompleted = [
      ...(alData.anime_done?.mediaList || []),
      ...(alData.manga_done?.mediaList  || [])
    ];

    const [enrichedMovies, enrichedShows] = await Promise.all([
      enrichTraktWithPosters(traktMoviesRaw.slice(0, 50), "movie"),
      enrichTraktWithPosters(traktShowsRaw.slice(0,  50), "show")
    ]);

    // Ручные записи из reviews.json — всё что не anime/manga/movie/show
    const manualEntries = (cache.reviews || []).filter(
      r => !["anime", "manga", "novel", "movie", "show"].includes(r.type)
    );

    cache.now = {
      alCurrent,
      alCompleted,
      traktMovies:    enrichedMovies,
      traktShows:     enrichedShows,
      manualEntries
    };
    renderNow(cache.now);

  } catch (err) {
    document.getElementById("tab-now").innerHTML =
      `<div class="state-box">
        <div style="font-size:2rem;margin-bottom:.75rem">⚠️</div>
        Ошибка: ${err.message}
      </div>`;
  }
}

function renderNow({ alCurrent, alCompleted, traktMovies, traktShows, manualEntries = [] }) {
  const box = document.getElementById("tab-now");
  let html  = "";

  // ── В процессе (только аниме + манга) ─────────
  if (alCurrent.length) {
    html += `<section class="group">
      <h2 class="section-title">В процессе</h2>
      <div class="grid-now">
        ${alCurrent.map((e, i) => nowCard(e, i)).join("")}
      </div>
    </section>`;
  }

  // ── Просмотрено — всё вместе, сортируем по дате ─
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
    ...manualEntries.map(e => {
      const d = e.date ? new Date(e.date) : new Date(0);
      return { _src: "manual", data: e, _sortDate: d, _sortYear: d.getFullYear() || 0 };
    })
  ];
  allCompleted.sort((a, b) => b._sortDate - a._sortDate);

  if (allCompleted.length) {
    // Группируем по году просмотра
    const byYear = {};
    for (const item of allCompleted) {
      const y = item._sortYear || "—";
      if (!byYear[y]) byYear[y] = [];
      byYear[y].push(item);
    }

    let completedHtml = "";
    for (const year of Object.keys(byYear).sort((a, b) => b - a)) {
      completedHtml += `<div class="year-divider">${year}</div>
        <div class="grid-now">
          ${byYear[year].map((item, i) => {
            if (item._src === "al")     return completedCard(item.data, i);
            if (item._src === "manual") return manualCard(item.data, i);
            return traktCard(item.data, item.type, i);
          }).join("")}
        </div>`;
    }

    html += `<section class="group">
      <h2 class="section-title">Просмотрено / Прочитано</h2>
      ${completedHtml}
    </section>`;
  }

  box.innerHTML = html || `<div class="state-box">Список пуст</div>`;
}
