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

    const favData = await fetch("/favorites.json?_=" + Date.now())
      .then(r => r.ok ? r.json() : [])
      .catch(() => []);

    const titles = (cache.reviews || [])
      .filter(r => r.favorite === true)
      .sort((a, b) => (a.fav_order ?? 9999) - (b.fav_order ?? 9999));

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
  const box   = document.getElementById("tab-favorites");
  const admin = isAdmin();
  let html    = "";

  // ── Тайтлы ──────────────────────────────────
  html += `<section class="group">
    <div class="section-header">
      <h2 class="section-title">Тайтлы</h2>
      ${admin ? `<a href="/reviews-order" class="admin-add-btn">⇅ Порядок</a><a href="/add" class="admin-add-btn">+ Добавить</a>` : ""}
    </div>
    <div class="grid-now">
      ${titles.length
        ? titles.map((r, i) => favTitleCard(r, i)).join("")
        : `<div class="state-box" style="padding:2rem 1rem;grid-column:1/-1;font-size:.95rem">Пока пусто</div>`}
    </div>
  </section>`;

  // ── Персонажи ────────────────────────────────
  html += `<section class="group">
    <div class="section-header">
      <h2 class="section-title">Персонажи</h2>
      ${admin ? `<a href="/favorites-edit" class="admin-add-btn">+ Добавить</a>` : ""}
    </div>
    <div class="grid-chars">
      ${characters.length
        ? characters.map((r, i) => favPersonCard(r, i)).join("")
        : `<div class="state-box" style="padding:2rem 1rem;grid-column:1/-1;font-size:.95rem">Пока пусто</div>`}
    </div>
  </section>`;

  // ── Персоны ──────────────────────────────────
  html += `<section class="group">
    <div class="section-header">
      <h2 class="section-title">Персоны</h2>
      ${admin ? `<a href="/favorites-edit" class="admin-add-btn">+ Добавить</a>` : ""}
    </div>
    <div class="grid-chars">
      ${persons.length
        ? persons.map((r, i) => favPersonCard(r, i)).join("")
        : `<div class="state-box" style="padding:2rem 1rem;grid-column:1/-1;font-size:.95rem">Пока пусто</div>`}
    </div>
  </section>`;

  box.innerHTML = html;
}

// Карточка тайтла (из reviews.json с favorite: true)
function favTitleCard(r, index) {
  const info     = findReviewForTitle(r.title, r.type);
  const tagLabel = TYPE_LABELS[r.type] || r.type || "—";
  const tagClass = ["anime","manga","novel","movie","show"].includes(r.type)
    ? `tag-${r.type}` : "tag-manual";

  const editId  = r.id ?? encodeURIComponent(r.title);
  const editBtn = isAdmin()
    ? `<a href="/add?edit=${editId}" class="review-edit-btn" title="Редактировать">✎</a>`
    : "";

  return `<div class="review-card-wrap" style="animation-delay:${Math.min(index * 25, 600)}ms">
    ${editBtn}
    <a href="${esc(r.url || "#")}" target="_blank" rel="noopener" class="card" style="animation-delay:0ms">
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
    </a>
  </div>`;
}

// Лейблы подтипов персон
const PERSON_SUBTYPE_LABELS = {
  actor:    "Актёр",
  director: "Режиссёр",
  author:   "Автор",
  seiyuu:   "Сэйю",
  artist:   "Художник",
  composer: "Композитор",
};

// Карточка персонажа или персоны (из favorites.json)
function favPersonCard(r, index) {
  const img = r.image || PH_SQ;

  const subLine = r.type === "person"
    ? (PERSON_SUBTYPE_LABELS[r.subtype] || "Персона")
    : (r.from || "");

  const sub = subLine
    ? `<div class="card-meta"><span>${esc(subLine)}</span></div>`
    : "";

  return `<div class="card card-char"
      style="animation-delay:${Math.min(index * 25, 500)}ms">
    <img src="${esc(img)}" alt="${esc(r.name)}" loading="lazy" onerror="this.src='${PH_SQ}'">
    <div class="card-body">
      <div class="card-title">${esc(r.name)}</div>
      ${sub}
    </div>
  </div>`;
}
