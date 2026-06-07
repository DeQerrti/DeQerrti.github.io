// ══════════════════════════════════════════════
//  FAVORITES — вкладка Любимое
//  Зависит от: config.js, api.js, cards.js
// ══════════════════════════════════════════════

const FAV_QUERY = `
query($name: String) {
  User(name: $name) {
    favourites {
      anime(perPage: 50) {
        nodes {
          id siteUrl format
          title { userPreferred romaji }
          coverImage { extraLarge large }
          startDate { year }
        }
      }
      manga(perPage: 50) {
        nodes {
          id siteUrl format
          title { userPreferred romaji }
          coverImage { extraLarge large }
          startDate { year }
        }
      }
      characters(perPage: 50) {
        nodes {
          id siteUrl
          name { full }
          image { large medium }
        }
      }
      staff(perPage: 50) {
        nodes {
          id siteUrl
          name { full }
          image { large medium }
        }
      }
    }
  }
}`;

async function loadFavorites() {
  if (cache.fav) { renderFavorites(cache.fav); return; }
  if (loading.fav) return;
  loading.fav = true;

  await fetchReviews();

  try {
    const [alData, traktMoviesRaw, traktShowsRaw] = await Promise.all([
      gql(FAV_QUERY, { name: AL_USERNAME }),
      traktFetch(`/users/${TRAKT_USERNAME}/ratings/movies?limit=50`).catch(() => []),
      traktFetch(`/users/${TRAKT_USERNAME}/ratings/shows?limit=50`).catch(() => [])
    ]);

    const favMovies = traktMoviesRaw.filter(r => r.rating >= 8);
    const favShows  = traktShowsRaw.filter(r => r.rating >= 8);

    const [enrichedMovies, enrichedShows] = await Promise.all([
      enrichTraktWithPosters(favMovies, "movie"),
      enrichTraktWithPosters(favShows,  "show")
    ]);

    cache.fav = {
      al:          alData.User.favourites,
      traktMovies: enrichedMovies,
      traktShows:  enrichedShows
    };
    renderFavorites(cache.fav);

  } catch (err) {
    document.getElementById("tab-favorites").innerHTML =
      `<div class="state-box">
        <div style="font-size:2rem;margin-bottom:.75rem">⚠️</div>
        Ошибка: ${esc(err.message)}
      </div>`;
  } finally {
    loading.fav = false;
  }
}

function renderFavorites({ al, traktMovies, traktShows }) {
  const box = document.getElementById("tab-favorites");

  const animes = al.anime?.nodes      || [];
  const mangas = al.manga?.nodes      || [];
  const chars  = al.characters?.nodes || [];
  const staff  = al.staff?.nodes      || [];

  const allTitles = [
    ...animes.map(item => ({ _src: "al-anime", data: item })),
    ...mangas.map(item => ({ _src: "al-manga", data: item })),
    ...traktMovies.map(item => ({ _src: "trakt", type: "movie", data: item })),
    ...traktShows.map(item  => ({ _src: "trakt", type: "show",  data: item }))
  ];

  let html = "";

  // ── Тайтлы ──────────────────────────────────
  if (allTitles.length) {
    html += `<section class="group">
      <h2 class="section-title">Тайтлы</h2>
      <div class="grid-now">
        ${allTitles.map((item, i) => favTitleCard(item, i)).join("")}
      </div>
    </section>`;
  }

  // ── Персонажи ────────────────────────────────
  if (chars.length) {
    html += `<section class="group">
      <h2 class="section-title">Персонажи</h2>
      <div class="grid-chars">
        ${chars.map((c, i) => personCard(c, i)).join("")}
      </div>
    </section>`;
  }

  // ── Персоны ──────────────────────────────────
  if (staff.length) {
    html += `<section class="group">
      <h2 class="section-title">Персоны</h2>
      <div class="grid-chars">
        ${staff.map((p, i) => personCard(p, i)).join("")}
      </div>
    </section>`;
  }

  box.innerHTML = html || `<div class="state-box">Фавориты не найдены</div>`;
}

// Карточка тайтла в разделе Любимое
function favTitleCard(item, index) {
  if (item._src === "trakt") {
    return traktCard(item.data, item.type, index);
  }

  const isNovel  = NOVEL_FORMATS.includes(item.data.format);
  const tagClass = item._src === "al-anime" ? "anime" : isNovel ? "novel" : "manga";
  const tagLabel = item._src === "al-anime" ? "Аниме" : isNovel ? "Ранобе" : "Манга";
  const t        = mediaTitle(item.data.title);
  const year     = item.data.startDate?.year || "";
  const info     = findReviewForTitle(t);

  return `<a href="${esc(item.data.siteUrl)}" target="_blank" rel="noopener" class="card"
      style="animation-delay:${Math.min(index * 25, 500)}ms">
    <span class="type-tag tag-${tagClass}">${esc(tagLabel)}</span>
    <img src="${esc(coverUrl(item.data.coverImage))}" alt="${esc(t)}" loading="lazy" onerror="this.src='${PH_TALL}'">
    <div class="card-body">
      <div class="card-title">${esc(t)}</div>
      ${year || info
        ? `<div class="card-meta">
            ${year ? `<span>${esc(String(year))}</span>` : ""}
            ${gradeInlineHtml(info)}
          </div>`
        : ""}
    </div>
  </a>`;
}
