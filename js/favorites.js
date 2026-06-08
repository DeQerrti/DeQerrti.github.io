// ══════════════════════════════════════════════
//  FAVORITES — вкладка Любимое
//  Зависит от: config.js, api.js, cards.js
//  Читает reviews.json — показывает записи с favorite: true
// ══════════════════════════════════════════════

async function loadFavorites() {
  if (cache.fav) { renderFavorites(cache.fav); return; }
  if (loading.fav) return;
  loading.fav = true;

  try {
    await fetchReviews();

    const all = cache.reviews || [];
    const favorites = all.filter(r => r.favorite === true);

    cache.fav = { favorites };
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

function renderFavorites({ favorites }) {
  const box = document.getElementById("tab-favorites");

  if (!favorites.length) {
    box.innerHTML = `<div class="state-box">Любимое пока пусто</div>`;
    return;
  }

  const cards = favorites.map((r, i) => favManualCard(r, i)).join("");

  box.innerHTML = `
    <section class="group">
      <h2 class="section-title">Любимое</h2>
      <div class="grid-now">${cards}</div>
    </section>`;
}

// Карточка любимой записи из reviews.json
function favManualCard(r, index) {
  const info = findReviewForTitle(r.title);
  const typeLabels = {
    anime: "Аниме", manga: "Манга", manhwa: "Манхва", manhua: "Маньхуа",
    novel: "Ранобэ", movie: "Фильм", show: "Сериал", dorama: "Дорама",
    book: "Книга", game: "Игра", gacha: "Гача"
  };
  const tagLabel = typeLabels[r.type] || r.type || "—";
  const tagClass = ["anime","manga","novel","movie","show"].includes(r.type)
    ? `tag-${r.type}` : "tag-manual";

  return `<a href="${esc(r.url || "#")}" target="_blank" rel="noopener" class="card"
      style="animation-delay:${Math.min(index * 25, 600)}ms">
    <span class="type-tag ${tagClass}">${esc(tagLabel)}</span>
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
  </a>`;
}
