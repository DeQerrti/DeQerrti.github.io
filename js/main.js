// ════════════════════════════════════════════════
// MAIN — Tab switching and initialization
// ════════════════════════════════════════════════

function switchTab(tabId, btn) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
  document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));
  document.getElementById(tabId).classList.remove("hidden");
  btn.classList.add("active");
  if (tabId === "tab-now")       loadNow();
  if (tabId === "tab-favorites") loadFavorites();
  if (tabId === "tab-reviews")   loadReviews();
}

async function loadNow() {
  if (getCached("now")) { renderNow(getCached("now")); return; }
  if (!getCached("reviews")) {
    await loadReviewsData();
  }
  try {
    const [alData, traktMoviesRaw, traktShowsRaw] = await Promise.all([
      gql(NOW_QUERY, { name: AL_USERNAME }),
      fetchTraktWatched("movie"),
      fetchTraktWatched("show")
    ]);
    const alCurrent = [
      ...(alData.anime_cur?.mediaList || []),
      ...(alData.manga_cur?.mediaList || [])
    ];
    const alCompleted = [
      ...(alData.anime_done?.mediaList || []),
      ...(alData.manga_done?.mediaList || [])
    ];
    const [enrichedMovies, enrichedShows] = await Promise.all([
      enrichTraktWithPosters(traktMoviesRaw.slice(0, 50), "movie"),
      enrichTraktWithPosters(traktShowsRaw.slice(0, 50), "show")
    ]);
    setCached("now", { alCurrent, alCompleted, traktMovies: enrichedMovies, traktShows: enrichedShows });
    renderNow(getCached("now"));
  } catch (err) {
    document.getElementById("tab-now").innerHTML =
      `<div class="state-box"><div style="font-size:2rem;margin-bottom:.75rem">⚠️</div>Ошибка: ${err.message}</div>`;
  }
}

const FAV_QUERY = `
query($name: String) {
  user(name: $name) {
    favourites {
      characters(perPage: 10) { nodes { id name { userPreferred } image { large } siteUrl } }
      anime(perPage: 10) { nodes { id title { userPreferred } coverImage { extraLarge large } siteUrl type format } }
    }
  }
}`;

async function loadFavorites() {
  if (getCached("favorites")) { renderFavorites(getCached("favorites")); return; }
  try {
    const data = await gql(FAV_QUERY, { name: AL_USERNAME });
    const characters = data.user.favourites.characters.nodes || [];
    const favorites = data.user.favourites.anime.nodes || [];
    setCached("favorites", { characters, favorites });
    renderFavorites({ characters, favorites });
  } catch (err) {
    document.getElementById("tab-favorites").innerHTML =
      `<div class="state-box"><div style="font-size:2rem;margin-bottom:.75rem">⚠️</div>Ошибка: ${err.message}</div>`;
  }
}

async function loadReviews() {
  if (getCached("reviews_rendered")) { renderReviews(getCached("reviews_rendered")); return; }
  if (!getCached("reviews")) {
    await loadReviewsData();
  }
  const reviews = getCached("reviews") || [];
  setCached("reviews_rendered", reviews);
  renderReviews(reviews);
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  loadNow();
});
