// ══════════════════════════════════════════════
//  TIERLIST — вкладка Тир-лист
//  Режим "Тайтлы" — из reviews.json по оценкам
//  Режим "Персонажи" — из characters-tier.json
//  Зависит от: config.js, api.js, cards.js
// ══════════════════════════════════════════════

const TL_FILTERS = [
  ["all",    "Всё"],
  ["anime",  "Аниме"],
  ["manga",  "Манга"],
  ["novel",  "Ранобэ"],
  ["movie",  "Фильмы"],
  ["show",   "Сериалы"],
  ["book",   "Книги"],
  ["game",   "Игры"],
  ["gacha",  "Гача"],
  ["manhwa", "Манхва"],
  ["manhua", "Маньхуа"],
];

function tlInferType(r) { return r.type || "anime"; }
function tlTypeLabel(type) { return TYPE_LABELS[type] || type || "—"; }

// Высота постеров персонажей — сохраняется между переключениями
let tlCharHeight = parseInt(localStorage.getItem("tl-char-height") || "200");

const tlState = {
  mode:        "titles",
  filter:      "all",
  yearFilter:  "all",
  gameId:      null,
  listId:      null,
  items:       [],
  collections: {}, // { [collectionId]: { games: [...], loaded: bool } }
  loaded:      false,
};

// Список коллекций (кроме "Тайтлы") — по умолчанию только встроенная
// "Персонажи", остальное настраивается в /settings-edit.
function activeTierCollections() {
  const configured = window.SITE_TIER_COLLECTIONS;
  return (configured && configured.length) ? configured : [{ id: "characters", label: "Персонажи" }];
}

function collectionFileFor(id) {
  return id === "characters" ? "characters-tier.json" : `tier-${id}.json`;
}

async function loadTierlist() {
  if (loading.tierlist) return;
  loading.tierlist = true;
  const box = document.getElementById("tab-tierlist");
  try {
    if (!tlState.loaded) {
      box.innerHTML = `<div class="state-box"><div class="spinner"></div>Загружаем…</div>`;
      await fetchReviews();
      const reviews  = (cache.reviews || []).filter(r => r.grade);
      tlState.items  = reviews.map(r => ({ review: r, poster: r.cover || null }));
      tlState.loaded = true;
    }
    tlRender();
  } catch (err) {
    box.innerHTML = `<div class="state-box">Ошибка: ${esc(err.message)}</div>`;
  } finally {
    loading.tierlist = false;
  }
}

async function loadCharGames(collectionId) {
  const existing = tlState.collections[collectionId];
  if (existing?.loaded) return;

  let games = [];
  try {
    const res = await fetch(collectionFileFor(collectionId));
    if (res.ok) games = await res.json();
  } catch {}

  tlState.collections[collectionId] = { games, loaded: true };

  if (games.length && !tlState.gameId) {
    tlState.gameId = games[0].id;
    tlState.listId = games[0].tierlists[0]?.id || null;
  }
}

function tlRender() {
  const box = document.getElementById("tab-tierlist");
  box.innerHTML = tlModeToggleHtml()
    + (tlState.mode === "titles" ? tlTitlesHtml() : tlCharsHtml(tlState.mode));
  tlBindAll();
}

function tlModeToggleHtml() {
  const collectionBtns = activeTierCollections().map(c =>
    `<button class="tl-mode-btn${tlState.mode === c.id ? " active" : ""}" data-mode="${esc(c.id)}">${esc(c.label)}</button>`
  ).join("");
  return `<div class="tl-mode-toggle">
    <button class="tl-mode-btn${tlState.mode === "titles" ? " active" : ""}" data-mode="titles">Тайтлы</button>
    ${collectionBtns}
  </div>`;
}

// ══ РЕЖИМ ТАЙТЛОВ ═════════════════════════════

function tlTitlesHtml() {
  const byType = tlState.filter === "all"
    ? tlState.items
    : tlState.items.filter(item => tlInferType(item.review) === tlState.filter);

  const filtered = tlState.yearFilter === "all"
    ? byType
    : byType.filter(item => String(statsCompletedYear(item.review) || "") === String(tlState.yearFilter));

  const byGrade = {};
  for (const item of filtered) {
    const g = gradeToShelf(item.review.grade);
    if (!byGrade[g]) byGrade[g] = [];
    byGrade[g].push(item);
  }

  const hasAny = TIER_ROWS.some(t => byGrade[t.key]?.length);
  let html = tlFiltersHtml() + tlYearFiltersHtml(byType);

  if (!hasAny) {
    return html + `<div class="state-box" style="padding-top:2rem">Ничего не найдено</div>`;
  }

  html += `<div class="tl-rows" id="tl-titles-rows">`;
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
        const src = poster || `https://placehold.co/72x108/111114/4a4540?text=${encodeURIComponent(r.title.slice(0, 2))}`;
        html += `<div class="tl-poster"
            data-tl-title="${esc(r.title)}"
            data-tl-grade="${esc(tier.label)}"
            data-tl-color="${esc(tier.color)}"
            data-tl-desc="${esc(GRADES[tier.key]?.desc || "")}"
            data-tl-year="${esc(String(r.year || ""))}"
            data-tl-type="${esc(tlTypeLabel(tlInferType(r)))}"
            style="animation-delay:${Math.min(i * 18, 400)}ms">
          <img src="${esc(src)}" alt="${esc(r.title)}" loading="lazy"
            onerror="this.src='https://placehold.co/72x108/111114/4a4540?text=?'">
        </div>`;
      }
    }
    html += `</div></div>`;
  }
  html += `</div>` + tlTooltipHtml();

  return html;
}

function tlFiltersHtml() {
  const btns = TL_FILTERS.map(([val, label]) =>
    `<button class="tl-filter${tlState.filter === val ? " active" : ""}" data-tl-type="${val}">${label}</button>`
  ).join("");
  return `<div class="tl-filters">${btns}</div>`;
}

function tlYearFiltersHtml(itemsForYearScope) {
  const years = [...new Set(
    itemsForYearScope.map(item => statsCompletedYear(item.review)).filter(Boolean)
  )].sort((a, b) => b - a);

  if (!years.length) return "";

  const options = [`<option value="all">Все года</option>`]
    .concat(years.map(y =>
      `<option value="${y}"${String(tlState.yearFilter) === String(y) ? " selected" : ""}>${y}</option>`
    )).join("");

  return `<div class="tl-year-select-wrap">
    <select class="tl-year-select" id="tl-year-select">${options}</select>
  </div>`;
}

// ══ РЕЖИМ ПЕРСОНАЖЕЙ ══════════════════════════

function tlCharsHtml(collectionId) {
  const collectionLabel = activeTierCollections().find(c => c.id === collectionId)?.label || collectionId;
  const state = tlState.collections[collectionId];

  if (!state?.loaded) {
    return `<div class="state-box"><div class="spinner"></div>Загружаем «${esc(collectionLabel)}»…</div>`;
  }
  if (!state.games.length) {
    const adminBtn = isAdmin()
      ? `<a href="/chars-edit?collection=${esc(collectionId)}" class="admin-add-btn">Редактор</a>`
      : "";
    return `<div class="state-box">Нет данных — ${adminBtn}</div>`;
  }

  const games = state.games;
  const game = games.find(g => g.id === tlState.gameId) || games[0];
  const list = game.tierlists.find(l => l.id === tlState.listId) || game.tierlists[0];

  const gameButtons = games.map(g =>
    `<button class="tl-filter${g.id === game.id ? " active" : ""}" data-char-game="${esc(g.id)}">${esc(g.title)}</button>`
  ).join("");

  const listButtons = game.tierlists.length > 1
    ? `<div class="tl-char-lists">
        ${game.tierlists.map(l =>
          `<button class="tl-list-btn${l.id === list.id ? " active" : ""}" data-char-list="${esc(l.id)}">${esc(l.label)}</button>`
        ).join("")}
      </div>`
    : "";

  let tiersHtml = `<div class="tl-rows" id="tl-chars-rows">`;
  for (let ti = 0; ti < list.tiers.length; ti++) {
    const tier  = list.tiers[ti];
    const chars = tier.chars || [];

    tiersHtml += `<div class="tl-row" style="--tl-color:${esc(tier.color)};animation-delay:${ti * 50}ms">
      <div class="tl-label">
        <div class="tl-label-dot"></div>
        <div class="tl-label-name">${esc(tier.name)}</div>
        ${chars.length ? `<div class="tl-label-count">${chars.length}</div>` : ""}
      </div>
      <div class="tl-cards">`;

    if (!chars.length) {
      tiersHtml += `<div class="tl-empty">—</div>`;
    } else {
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        tiersHtml += `<div class="tl-char-poster"
            data-tl-title="${esc(ch.name)}"
            data-tl-grade="${esc(tier.name)}"
            data-tl-color="${esc(tier.color)}"
            data-tl-desc=""
            data-tl-year=""
            data-tl-type="${esc(game.title)}"
            style="height:${tlCharHeight}px;animation-delay:${Math.min(i * 18, 400)}ms">
          <img src="${esc(ch.img)}" alt="${esc(ch.name)}" loading="lazy"
            onerror="this.src='https://placehold.co/100x150/111114/4a4540?text=?'">
        </div>`;
      }
    }
    tiersHtml += `</div></div>`;
  }
  tiersHtml += `</div>`;

  const adminBtn = isAdmin()
    ? `<a href="/chars-edit?collection=${esc(collectionId)}" class="admin-add-btn">Редактор</a>`
    : "";

  const exportBtn = `<button class="admin-add-btn" id="tl-export-btn" onclick="tlExport('tl-chars-rows', '${esc(game.title)}')">Сохранить как картинку</button>`;

  // Ползунок размера — теперь до 1000px
  const slider = `<div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1.2rem">
    <span style="font-family:'DM Sans',sans-serif;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;color:var(--text-dim);flex-shrink:0">Размер</span>
    <input type="range" min="80" max="1000" value="${tlCharHeight}" step="10"
      id="tl-char-size-slider"
      style="flex:1;max-width:200px;accent-color:var(--red);cursor:pointer">
    <span id="tl-char-size-val" style="font-family:'DM Sans',sans-serif;font-size:.65rem;color:var(--text-dim);min-width:42px">${tlCharHeight}px</span>
  </div>`;

  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:.5rem;flex-wrap:wrap">
    <div class="tl-filters" style="margin-bottom:0">${gameButtons}</div>
    <div style="display:flex;gap:.5rem;flex-shrink:0">${adminBtn}${exportBtn}</div>
  </div>
  ${listButtons}
  ${slider}
  ${tiersHtml}
  ${tlTooltipHtml()}`;
}

// ── Тултип ─────────────────────────────────────
function tlTooltipHtml() {
  return `<div class="tl-tooltip" id="tl-tooltip">
    <div class="tl-tt-title" id="tl-tt-title"></div>
    <div class="tl-tt-grade" id="tl-tt-grade"></div>
    <div class="tl-tt-desc"  id="tl-tt-desc"></div>
    <div class="tl-tt-meta"  id="tl-tt-meta"></div>
  </div>`;
}

// ── Бинды ──────────────────────────────────────
function tlBindAll() {
  document.querySelectorAll(".tl-mode-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const newMode = btn.dataset.mode;
      if (newMode !== "titles" && !tlState.collections[newMode]?.loaded) {
        const label = activeTierCollections().find(c => c.id === newMode)?.label || newMode;
        tlState.mode = newMode;
        tlState.gameId = null;
        tlState.listId = null;
        const box = document.getElementById("tab-tierlist");
        box.innerHTML = tlModeToggleHtml()
          + `<div class="state-box"><div class="spinner"></div>Загружаем «${esc(label)}»…</div>`;
        await loadCharGames(newMode);
      } else {
        tlState.mode = newMode;
      }
      tlRender();
    });
  });

  document.querySelectorAll(".tl-filter[data-tl-type]").forEach(btn => {
    btn.addEventListener("click", () => {
      tlState.filter = btn.dataset.tlType;
      tlState.yearFilter = "all"; // при смене типа список годов меняется — сбрасываем
      tlRender();
    });
  });

  const yearSelect = document.getElementById("tl-year-select");
  if (yearSelect) {
    yearSelect.addEventListener("change", () => {
      tlState.yearFilter = yearSelect.value;
      tlRender();
    });
  }

  document.querySelectorAll("[data-char-game]").forEach(btn => {
    btn.addEventListener("click", () => {
      tlState.gameId = btn.dataset.charGame;
      const games = tlState.collections[tlState.mode]?.games || [];
      const game = games.find(g => g.id === tlState.gameId);
      tlState.listId = game?.tierlists[0]?.id || null;
      tlRender();
    });
  });

  document.querySelectorAll("[data-char-list]").forEach(btn => {
    btn.addEventListener("click", () => {
      tlState.listId = btn.dataset.charList;
      tlRender();
    });
  });

  // Ползунок размера
  const slider = document.getElementById("tl-char-size-slider");
  if (slider) {
    slider.addEventListener("input", () => {
      tlCharHeight = parseInt(slider.value);
      localStorage.setItem("tl-char-height", tlCharHeight);
      document.getElementById("tl-char-size-val").textContent = tlCharHeight + "px";
      document.querySelectorAll(".tl-char-poster").forEach(el => {
        el.style.height = tlCharHeight + "px";
      });
    });
  }

  tlBindTooltip();
}

function tlBindTooltip() {
  const tip = document.getElementById("tl-tooltip");
  if (!tip) return;

  document.querySelectorAll(".tl-poster, .tl-char-poster").forEach(card => {
    card.addEventListener("mouseenter", e => { tlShowTip(card, tip); tlMoveTip(e, tip); });
    card.addEventListener("mousemove",  e => tlMoveTip(e, tip));
    card.addEventListener("mouseleave", () => tip.classList.remove("visible"));

    card.addEventListener("touchstart", e => {
      e.preventDefault();
      const already = tip.classList.contains("visible") && tip.dataset.activeCard === card.dataset.tlTitle;
      tip.classList.remove("visible");
      if (!already) {
        tlShowTip(card, tip);
        tip.dataset.activeCard = card.dataset.tlTitle;
        const rect = card.getBoundingClientRect();
        let x = rect.left + rect.width / 2 - 110;
        let y = rect.top - (tip.offsetHeight || 110) - 8;
        x = Math.max(8, Math.min(x, window.innerWidth - 228));
        y = y < 8 ? rect.bottom + 8 : y;
        tip.style.left     = x + "px";
        tip.style.top      = (y + window.scrollY) + "px";
        tip.style.position = "absolute";
      }
    }, { passive: false });
  });

  document.addEventListener("touchstart", e => {
    if (!e.target.closest(".tl-poster") && !e.target.closest(".tl-char-poster") && !e.target.closest(".tl-tooltip")) {
      tip.classList.remove("visible");
    }
  });
}

function tlShowTip(card, tip) {
  document.getElementById("tl-tt-title").textContent = card.dataset.tlTitle;
  document.getElementById("tl-tt-grade").textContent = card.dataset.tlGrade;
  document.getElementById("tl-tt-grade").style.color = card.dataset.tlColor;
  document.getElementById("tl-tt-desc").textContent  = card.dataset.tlDesc;
  const meta = [card.dataset.tlType, card.dataset.tlYear].filter(Boolean).join(" · ");
  document.getElementById("tl-tt-meta").textContent  = meta;
  tip.classList.add("visible");
}

function tlMoveTip(e, tip) {
  const m = 14;
  let x = e.clientX + m, y = e.clientY + m;
  const tw = tip.offsetWidth || 220, th = tip.offsetHeight || 100;
  if (x + tw > window.innerWidth)  x = e.clientX - tw - m;
  if (y + th > window.innerHeight) y = e.clientY - th - m;
  if (x < 4) x = 4;
  if (y < 4) y = 4;
  tip.style.position = "fixed";
  tip.style.left = x + "px";
  tip.style.top  = y + "px";
}

// ══ ЭКСПОРТ ТИР-ЛИСТА ПЕРСОНАЖЕЙ В КАРТИНКУ ══════════════

async function tlExport(rowsId, label) {
  const btn = document.getElementById("tl-export-btn");
  if (btn) { btn.textContent = "⏳ Создаём…"; btn.disabled = true; }

  const tip = document.getElementById("tl-tooltip");
  if (tip) tip.style.visibility = "hidden";

  let animated = [];
  let prevAnimation = [];
  let restoreImages = () => {};

  try {
    const rows = document.getElementById(rowsId);
    if (!rows) throw new Error("Тир-лист не найден");

    if (typeof html2canvas === "undefined") {
      if (btn) btn.textContent = "⏳ Загружаем библиотеку…";
      await loadHtml2Canvas();
      if (btn) btn.textContent = "⏳ Создаём…";
    }

    const imgs = Array.from(rows.querySelectorAll("img"));
    await Promise.all(imgs.map(img =>
      img.complete ? Promise.resolve() : new Promise(res => {
        img.onload = img.onerror = res;
      })
    ));

    restoreImages = await proxyImagesToDataUrls(rows);

    animated = Array.from(rows.querySelectorAll(".tl-row, .tl-poster, .tl-char-poster"));
    prevAnimation = animated.map(el => el.style.animation);
    animated.forEach(el => { el.style.animation = "none"; });
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));

    const canvas = await html2canvas(rows, {
      backgroundColor: "#0a0a0c",
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
    });

    const link = document.createElement("a");
    const safeName = label.replace(/[^a-zA-Zа-яА-Я0-9_\- ]/g, "").trim() || "tierlist";
    link.download = `${safeName}-tierlist.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();

  } catch (err) {
    alert("Не удалось создать картинку 😢\n" + err.message);
  } finally {
    restoreImages();
    animated.forEach((el, i) => { el.style.animation = prevAnimation[i]; });
    if (tip) tip.style.visibility = "";
    if (btn) { btn.textContent = "Сохранить как картинку"; btn.disabled = false; }
  }
}
