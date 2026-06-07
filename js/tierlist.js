// ══════════════════════════════════════════════
//  TIERLIST — вкладка Тир-лист
//  Зависит от: config.js, api.js, cards.js
// ══════════════════════════════════════════════

const TIER_ROWS = [
  { key: "rezonans",     label: "Резонанс",     color: "#7c3aed" },
  { key: "etalon",       label: "Эталон",        color: "#2563a8" },
  { key: "vyskazyvanie", label: "Высказывание",  color: "#2d8a4e" },
  { key: "attrakcion",   label: "Аттракцион",    color: "#d4a017" },
  { key: "fon",          label: "Фоновый шум",   color: "#6b7280" },
  { key: "razocharo",    label: "Разочарование", color: "#8B6914" },
  { key: "brak",         label: "Брак",          color: "#c0392b" },
];

// Тип тайтла из reviews.json
function tlInferType(r) {
  return r.type || "anime";
}

function tlTypeLabel(type) {
  return {
    anime: "Аниме", manga: "Манга", novel: "Ранобе",
    movie: "Фильм", show: "Сериал", book: "Книга",
    game: "Игра", vn: "Визуал. новелла"
  }[type] || type || "—";
}

// ── Загрузка постера ───────────────────────────
async function tlFetchPoster(r) {
  // Ручная обложка — приоритет
  if (r.cover) return r.cover;

  const type = tlInferType(r);

  // Игры/VN без cover — плейсхолдер
  if (type === "game" || type === "vn") return null;

  // Аниме / манга / ранобе → AniList
  if (!type || type === "anime" || type === "manga" || type === "novel") {
    try {
      const d = await gql(`query($t:String){Media(search:$t,type:ANIME){coverImage{large}}}`, { t: r.title });
      if (d?.Media?.coverImage?.large) return d.Media.coverImage.large;
    } catch {}
    try {
      const d = await gql(`query($t:String){Media(search:$t,type:MANGA){coverImage{large}}}`, { t: r.title });
      if (d?.Media?.coverImage?.large) return d.Media.coverImage.large;
    } catch {}
  }

  // Фильмы / сериалы → TMDb
  if (type === "movie" || type === "show") {
    try {
      const endpoint = type === "movie" ? "movie" : "tv";
      const res = await tmdbFetch(`/search/${endpoint}?query=${encodeURIComponent(r.title)}&language=en-US`);
      const hit = res.results?.[0];
      if (hit?.poster_path) return tmdbPoster(hit.poster_path);
    } catch {}
  }

  // Последняя попытка — multi-поиск TMDb
  try {
    const res = await tmdbFetch(`/search/multi?query=${encodeURIComponent(r.title)}&language=en-US`);
    const hit = res.results?.find(x => x.poster_path);
    if (hit?.poster_path) return tmdbPoster(hit.poster_path);
  } catch {}

  return null;
}

// ── Состояние вкладки ──────────────────────────
const tlState = {
  items: [],       // { review, poster }
  filter: "all",
  loaded: false,
};

// ── Загрузка данных ────────────────────────────
async function loadTierlist() {
  if (loading.tierlist) return;
  loading.tierlist = true;

  const box = document.getElementById("tab-tierlist");

  // Если уже загружено — просто перерисовываем
  if (tlState.loaded) {
    tlRender();
    loading.tierlist = false;
    return;
  }

  box.innerHTML = `<div class="state-box"><div class="spinner"></div>Загружаем рецензии…</div>`;

  try {
    await fetchReviews();
    const reviews = (cache.reviews || []).filter(r => r.grade);

    if (!reviews.length) {
      box.innerHTML = `<div class="state-box">Нет тайтлов с оценкой</div>`;
      loading.tierlist = false;
      return;
    }

    // Сразу показываем без постеров
    tlState.items = reviews.map(r => ({ review: r, poster: r.cover || null }));
    tlState.loaded = true;
    tlRender();

    // Догружаем постеры батчами фоново
    const BATCH = 6;
    for (let i = 0; i < tlState.items.length; i += BATCH) {
      const chunk = tlState.items.slice(i, i + BATCH);
      await Promise.all(chunk.map(async item => {
        if (item.poster) return;
        item.poster = await tlFetchPoster(item.review);
      }));
      tlPatchPosters(tlState.items.slice(i, i + BATCH));
    }

  } catch (err) {
    box.innerHTML = `<div class="state-box">Ошибка: ${esc(err.message)}</div>`;
  } finally {
    loading.tierlist = false;
  }
}

// ── Рендер ────────────────────────────────────
function tlRender() {
  const box = document.getElementById("tab-tierlist");

  const filtered = tlState.filter === "all"
    ? tlState.items
    : tlState.items.filter(item => tlInferType(item.review) === tlState.filter);

  // Группировка по грейду
  const byGrade = {};
  for (const item of filtered) {
    const g = item.review.grade;
    if (!byGrade[g]) byGrade[g] = [];
    byGrade[g].push(item);
  }

  const hasAny = TIER_ROWS.some(t => byGrade[t.key]?.length);

  let html = tlFiltersHtml();

  if (!hasAny) {
    html += `<div class="state-box" style="padding-top:2rem">Ничего не найдено</div>`;
    box.innerHTML = html;
    tlBindFilters();
    return;
  }

  html += `<div class="tl-rows">`;

  for (let ti = 0; ti < TIER_ROWS.length; ti++) {
    const tier  = TIER_ROWS[ti];
    const items = byGrade[tier.key] || [];

    html += `<div class="tl-row" style="--tl-color:${tier.color};animation-delay:${ti * 50}ms">
      <div class="tl-label">
        <div class="tl-label-dot"></div>
        <div class="tl-label-name">${esc(tier.label)}</div>
        ${items.length ? `<div class="tl-label-count">${items.length}</div>` : ""}
      </div>
      <div class="tl-cards">`;

    if (!items.length) {
      html += `<div class="tl-empty">—</div>`;
    } else {
      for (let i = 0; i < items.length; i++) {
        const { review: r, poster } = items[i];
        const src = poster
          || `https://placehold.co/72x108/111114/4a4540?text=${encodeURIComponent(r.title.slice(0, 2))}`;
        const type = tlInferType(r);
        html += `<div class="tl-poster"
            data-tl-title="${esc(r.title)}"
            data-tl-grade="${esc(tier.label)}"
            data-tl-color="${esc(tier.color)}"
            data-tl-desc="${esc(GRADES[tier.key]?.desc || "")}"
            data-tl-year="${esc(String(r.year || ""))}"
            data-tl-type="${esc(tlTypeLabel(type))}"
            style="animation-delay:${Math.min(i * 18, 400)}ms">
          <img src="${esc(src)}" alt="${esc(r.title)}" loading="lazy"
            onerror="this.src='https://placehold.co/72x108/111114/4a4540?text=?'">
          <div class="tl-type-tag">${esc(tlTypeLabel(type))}</div>
        </div>`;
      }
    }

    html += `</div></div>`;
  }

  html += `</div>`;
  html += tlTooltipHtml();

  box.innerHTML = html;
  tlBindFilters();
  tlBindTooltip();
}

// ── Фильтры ───────────────────────────────────
function tlFiltersHtml() {
  const types = [
    ["all",   "Всё"],
    ["anime", "Аниме"],
    ["manga", "Манга"],
    ["novel", "Ранобе"],
    ["movie", "Фильмы"],
    ["show",  "Сериалы"],
    ["book",  "Книги"],
    ["game",  "Игры"],
    ["vn",    "Визуальные новеллы"],
  ];
  const btns = types.map(([val, label]) =>
    `<button class="tl-filter${tlState.filter === val ? " active" : ""}" data-tl-type="${val}">${label}</button>`
  ).join("");
  return `<div class="tl-filters">${btns}</div>`;
}

function tlBindFilters() {
  document.querySelectorAll(".tl-filter").forEach(btn => {
    btn.addEventListener("click", () => {
      tlState.filter = btn.dataset.tlType;
      tlRender();
    });
  });
}

// ── Тултип ────────────────────────────────────
function tlTooltipHtml() {
  return `<div class="tl-tooltip" id="tl-tooltip">
    <div class="tl-tt-title" id="tl-tt-title"></div>
    <div class="tl-tt-grade" id="tl-tt-grade"></div>
    <div class="tl-tt-desc"  id="tl-tt-desc"></div>
    <div class="tl-tt-meta"  id="tl-tt-meta"></div>
  </div>`;
}

function tlBindTooltip() {
  const tip    = document.getElementById("tl-tooltip");
  if (!tip) return;

  document.querySelectorAll(".tl-poster").forEach(card => {
    card.addEventListener("mouseenter", e => {
      document.getElementById("tl-tt-title").textContent = card.dataset.tlTitle;
      document.getElementById("tl-tt-grade").textContent = card.dataset.tlGrade;
      document.getElementById("tl-tt-grade").style.color = card.dataset.tlColor;
      document.getElementById("tl-tt-desc").textContent  = card.dataset.tlDesc;
      const meta = [card.dataset.tlType, card.dataset.tlYear].filter(Boolean).join(" · ");
      document.getElementById("tl-tt-meta").textContent  = meta;
      tip.classList.add("visible");
      tlMoveTip(e, tip);
    });
    card.addEventListener("mousemove", e => tlMoveTip(e, tip));
    card.addEventListener("mouseleave", () => tip.classList.remove("visible"));
  });
}

function tlMoveTip(e, tip) {
  const m = 14;
  let x = e.clientX + m, y = e.clientY + m;
  const tw = tip.offsetWidth || 220, th = tip.offsetHeight || 100;
  if (x + tw > window.innerWidth)  x = e.clientX - tw - m;
  if (y + th > window.innerHeight) y = e.clientY - th - m;
  tip.style.left = x + "px";
  tip.style.top  = y + "px";
}

// ── Патч постеров без перерисовки ─────────────
function tlPatchPosters(items) {
  for (const item of items) {
    if (!item.poster) continue;
    const card = document.querySelector(`.tl-poster[data-tl-title="${CSS.escape(item.review.title)}"]`);
    if (!card) continue;
    const img = card.querySelector("img");
    if (img && img.src.includes("placehold.co")) img.src = item.poster;
  }
}
