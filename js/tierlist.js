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
  gameId:      null,
  listId:      null,
  items:       [],
  charGames:   [],
  loaded:      false,
  charsLoaded: false,
};

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

async function loadCharGames() {
  if (tlState.charsLoaded) return;
  try {
    const res = await fetch("characters-tier.json");
    if (!res.ok) throw new Error("characters-tier.json не найден");
    tlState.charGames   = await res.json();
    tlState.charsLoaded = true;
    if (tlState.charGames.length && !tlState.gameId) {
      tlState.gameId = tlState.charGames[0].id;
      tlState.listId = tlState.charGames[0].tierlists[0]?.id || null;
    }
  } catch {
    tlState.charGames   = [];
    tlState.charsLoaded = true;
  }
}

function tlRender() {
  const box = document.getElementById("tab-tierlist");
  box.innerHTML = tlModeToggleHtml()
    + (tlState.mode === "titles" ? tlTitlesHtml() : tlCharsHtml());
  tlBindAll();
}

function tlModeToggleHtml() {
  return `<div class="tl-mode-toggle">
    <button class="tl-mode-btn${tlState.mode === "titles" ? " active" : ""}" data-mode="titles">Тайтлы</button>
    <button class="tl-mode-btn${tlState.mode === "chars"  ? " active" : ""}" data-mode="chars">Персонажи</button>
  </div>`;
}

// ══ РЕЖИМ ТАЙТЛОВ ═════════════════════════════

function tlTitlesHtml() {
  const filtered = tlState.filter === "all"
    ? tlState.items
    : tlState.items.filter(item => tlInferType(item.review) === tlState.filter);

  const byGrade = {};
  for (const item of filtered) {
    const g = item.review.grade;
    if (!byGrade[g]) byGrade[g] = [];
    byGrade[g].push(item);
  }

  const hasAny = TIER_ROWS.some(t => byGrade[t.key]?.length);
  let html = tlFiltersHtml();

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

  // Кнопка экспорта тайтлов
  html += `<div style="margin-top:1.2rem">
    <button class="admin-add-btn" id="tl-export-titles-btn" onclick="tlExport('tl-titles-rows', 'titles')">Сохранить как картинку</button>
  </div>`;

  return html;
}

function tlFiltersHtml() {
  const btns = TL_FILTERS.map(([val, label]) =>
    `<button class="tl-filter${tlState.filter === val ? " active" : ""}" data-tl-type="${val}">${label}</button>`
  ).join("");
  return `<div class="tl-filters">${btns}</div>`;
}

// ══ РЕЖИМ ПЕРСОНАЖЕЙ ══════════════════════════

function tlCharsHtml() {
  if (!tlState.charsLoaded) {
    return `<div class="state-box"><div class="spinner"></div>Загружаем персонажей…</div>`;
  }
  if (!tlState.charGames.length) {
    return `<div class="state-box">Нет данных о персонажах</div>`;
  }

  const game = tlState.charGames.find(g => g.id === tlState.gameId) || tlState.charGames[0];
  const list = game.tierlists.find(l => l.id === tlState.listId) || game.tierlists[0];

  const gameButtons = tlState.charGames.map(g =>
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
    ? `<a href="/chars-edit" class="admin-add-btn">Редактор</a>`
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
      tlState.mode = btn.dataset.mode;
      if (tlState.mode === "chars" && !tlState.charsLoaded) {
        const box = document.getElementById("tab-tierlist");
        box.innerHTML = tlModeToggleHtml()
          + `<div class="state-box"><div class="spinner"></div>Загружаем персонажей…</div>`;
        await loadCharGames();
      }
      tlRender();
    });
  });

  document.querySelectorAll(".tl-filter[data-tl-type]").forEach(btn => {
    btn.addEventListener("click", () => {
      tlState.filter = btn.dataset.tlType;
      tlRender();
    });
  });

  document.querySelectorAll("[data-char-game]").forEach(btn => {
    btn.addEventListener("click", () => {
      tlState.gameId = btn.dataset.charGame;
      const game = tlState.charGames.find(g => g.id === tlState.gameId);
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

// ══ ЭКСПОРТ ТИР-ЛИСТА В КАРТИНКУ ══════════════

async function tlExport(rowsId, label) {
  const btnId = rowsId === "tl-chars-rows" ? "tl-export-btn" : "tl-export-titles-btn";
  const btn = document.getElementById(btnId);
  if (btn) { btn.textContent = "⏳ Создаём…"; btn.disabled = true; }

  // Скрываем тултип на время скриншота
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

    // Ждём загрузки всех изображений в этом контейнере
    const imgs = Array.from(rows.querySelectorAll("img"));
    await Promise.all(imgs.map(img =>
      img.complete ? Promise.resolve() : new Promise(res => {
        img.onload = img.onerror = res;
      })
    ));

    // Обложки с внешних CDN (TMDB/IGDB/AniList и т.д.) без прокси
    // html2canvas нарисует пустыми прямоугольниками — см. комментарий
    // у proxyImagesToDataUrls() в config.js.
    restoreImages = await proxyImagesToDataUrls(rows);

    // "Приземляем" CSS-анимации появления (fadeUp с animation-delay по индексу) —
    // если экспорт нажат сразу после открытия вкладки, поздние ряды/постеры
    // ещё не доанимировались и html2canvas фотографирует их полупрозрачными.
    // Временно убираем animation, чтобы зафиксировать финальное состояние
    // (opacity:1, без translateY); восстанавливаем в finally — даже если
    // дальше что-то упадёт с ошибкой, страница не останется без анимаций.
    animated = Array.from(rows.querySelectorAll(".tl-row, .tl-poster, .tl-char-poster"));
    prevAnimation = animated.map(el => el.style.animation);
    animated.forEach(el => { el.style.animation = "none"; });
    // Даём браузеру один кадр, чтобы применить стиль до снимка
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
