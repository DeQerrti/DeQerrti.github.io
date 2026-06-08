// ══════════════════════════════════════════════
//  FAVORITES — вкладка Любимое
//  Зависит от: config.js, api.js, cards.js
//  Тайтлы — из reviews.json по флагу favorite: true
//  Персонажи и персоны — из favorites.json
// ══════════════════════════════════════════════

async function loadFavorites() {
  if (cache.fav) { renderFavorites(cache.fav); return; }
  if (loading.fav) return;
  loading.fav = true;

  try {
    await fetchReviews();

    const [favData] = await Promise.all([
      fetch("/favorites.json?_=" + Date.now())
        .then(r => r.ok ? r.json() : [])
        .catch(() => [])
    ]);

    const titles     = (cache.reviews || []).filter(r => r.favorite === true);
    const characters = favData.filter(r => r.type === "character");
    const persons    = favData.filter(r => r.type === "person");

    cache.fav = { titles, characters, persons };
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

function renderFavorites({ titles, characters, persons }) {
  const box = document.getElementById("tab-favorites");
  let html  = "";

  // ── Тайтлы ──────────────────────────────────
  if (titles.length) {
    html += `<section class="group">
      <h2 class="section-title">Тайтлы</h2>
      <div class="grid-now">
        ${titles.map((r, i) => favTitleCard(r, i)).join("")}
      </div>
    </section>`;
  }

  // ── Персонажи ────────────────────────────────
  if (characters.length) {
    html += `<section class="group">
      <h2 class="section-title">Персонажи</h2>
      <div class="grid-chars">
        ${characters.map((r, i) => favPersonCard(r, i)).join("")}
      </div>
    </section>`;
  }

  // ── Персоны ──────────────────────────────────
  if (persons.length) {
    html += `<section class="group">
      <h2 class="section-title">Персоны</h2>
      <div class="grid-chars">
        ${persons.map((r, i) => favPersonCard(r, i)).join("")}
      </div>
    </section>`;
  }

  box.innerHTML = html || `<div class="state-box">Любимое пока пусто</div>`;
}

// Карточка тайтла (из reviews.json)
function favTitleCard(r, index) {
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

// Карточка персонажа или персоны (из favorites.json)
function favPersonCard(r, index) {
  const img = r.image || PH_SQ;
  const sub = r.from ? `<div class="card-meta"><span>${esc(r.from)}</span></div>` : "";

  return `<a href="${esc(r.url || "#")}" target="_blank" rel="noopener"
      class="card card-char"
      style="animation-delay:${Math.min(index * 25, 500)}ms">
    <img src="${esc(img)}" alt="${esc(r.name)}" loading="lazy" onerror="this.src='${PH_SQ}'">
    <div class="card-body">
      <div class="card-title">${esc(r.name)}</div>
      ${sub}
    </div>
  </a>`;
}
