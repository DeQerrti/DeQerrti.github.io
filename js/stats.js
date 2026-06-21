// ══════════════════════════════════════════════
//  STATS — вкладка Статистика
//  Читает только из reviews.json
//  Зависит от: config.js, api.js, cards.js
// ══════════════════════════════════════════════

// ── Цвета по типам ─────────────────────────────
const TYPE_COLORS = {
  anime:   "#8b1a1a",   // бардовый
  manga:   "#1a4a8b",   // синий
  manhwa:  "#2563a8",   // синий светлее
  manhua:  "#4a7abf",   // синий ещё светлее
  novel:   "#5a2d8a",   // фиолетовый
  book:    "#8a4abf",   // фиолетовый светлее
  movie:   "#1a6b3a",   // зелёный
  show:    "#2d8a52",   // зелёный светлее
  dorama:  "#4aab6e",   // зелёный ещё светлее
  game:    "#8b6914",   // жёлтый тёмный
  gacha:   "#c0a020",   // жёлтый светлее
};

// Выбранный год дайджеста. "all" — обычная статистика за всё время.
const statsState = { year: "all" };

async function loadStats() {
  if (loading.stats) return;
  loading.stats = true;

  const box = document.getElementById("tab-stats");
  box.innerHTML = `<div class="state-box"><div class="spinner"></div>Считаем…</div>`;

  try {
    await fetchReviews();
    statsRender();
  } catch (err) {
    box.innerHTML = `<div class="state-box">Ошибка: ${esc(err.message)}</div>`;
  } finally {
    loading.stats = false;
  }
}

// Тайтл считается "завершённым в году Y", если в этом году дата
// окончания (или начала, если конца нет — старые записи без date_end)
function statsCompletedYear(r) {
  const raw = r.date_end || r.date_start || r.date;
  return raw ? new Date(raw).getFullYear() : null;
}

function statsRender() {
  const box     = document.getElementById("tab-stats");
  const reviews = cache.reviews || [];

  const completed = reviews.filter(r =>
    r.status === "completed" || (!r.status && (r.preview || r.grade))
  );

  const yearsSet = new Set();
  for (const r of completed) {
    const y = statsCompletedYear(r);
    if (y) yearsSet.add(y);
  }
  const years = [...yearsSet].sort((a, b) => b - a);

  const filtersHtml = statsYearFiltersHtml(years);
  const bodyHtml = statsState.year === "all"
    ? renderAllTimeStats(reviews, completed)
    : renderYearDigest(statsState.year, completed);

  box.innerHTML = filtersHtml + bodyHtml;

  animateCounters();
  animateStackedBars();
  statsBindAll();
}

// ── Переключатель года ─────────────────────────
function statsYearFiltersHtml(years) {
  const allBtn = `<button class="tl-filter${statsState.year === "all" ? " active" : ""}" data-stat-year="all">Всё время</button>`;
  const yearBtns = years.map(y =>
    `<button class="tl-filter${String(statsState.year) === String(y) ? " active" : ""}" data-stat-year="${y}">${y}</button>`
  ).join("");
  return `<div class="stat-year-filters">${allBtn}${yearBtns}</div>`;
}

function statsBindAll() {
  document.querySelectorAll(".tl-filter[data-stat-year]").forEach(btn => {
    btn.addEventListener("click", () => {
      statsState.year = btn.dataset.statYear === "all" ? "all" : parseInt(btn.dataset.statYear);
      statsRender();
    });
  });

  const exportBtn = document.getElementById("stats-export-btn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => statsExport(exportBtn.dataset.statExportYear));
  }
}

// ── Статистика за всё время (как было) ─────────
function renderAllTimeStats(reviews, completed) {
  const withGrade = reviews.filter(r => r.grade);

  const typeCounts = {};
  for (const r of withGrade) {
    const t = r.type || "anime";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  const counts = Object.entries(TYPE_LABELS)
    .map(([key, label]) => ({ key, label, val: typeCounts[key] || 0, color: TYPE_COLORS[key] || "#666" }))
    .filter(c => c.val > 0);
  const total = counts.reduce((s, c) => s + c.val, 0);

  const watchYearsByType = {};
  for (const r of completed) {
    const y = statsCompletedYear(r);
    if (!y) continue;
    const t = r.type || "anime";
    if (!watchYearsByType[y]) watchYearsByType[y] = {};
    watchYearsByType[y][t] = (watchYearsByType[y][t] || 0) + 1;
  }

  const releaseYearsByType = {};
  for (const r of withGrade) {
    const y = parseInt(r.year);
    if (!y) continue;
    const t = r.type || "anime";
    if (!releaseYearsByType[y]) releaseYearsByType[y] = {};
    releaseYearsByType[y][t] = (releaseYearsByType[y][t] || 0) + 1;
  }

  const gradeCounts = {};
  for (const r of withGrade) gradeCounts[r.grade] = (gradeCounts[r.grade] || 0) + 1;

  const tagCounts = {};
  for (const r of reviews) {
    for (const tag of (r.tags || [])) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);

  return `
    ${renderCounters(counts, total)}
    ${renderDonut(counts, total)}
    ${renderStackedBarChart("По годам просмотра", "watch-bars", watchYearsByType)}
    ${renderStackedBarChart("По годам выхода",    "release-bars", releaseYearsByType)}
    ${renderGradeChart(gradeCounts)}
    ${renderTagCloud(topTags)}
  `;
}

// ── Годовой дайджест ────────────────────────────
function renderYearDigest(year, completed) {
  const yearReviews = completed.filter(r => statsCompletedYear(r) === year);
  const withGrade   = yearReviews.filter(r => r.grade);

  const typeCounts = {};
  for (const r of withGrade) {
    const t = r.type || "anime";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  const counts = Object.entries(TYPE_LABELS)
    .map(([key, label]) => ({ key, label, val: typeCounts[key] || 0, color: TYPE_COLORS[key] || "#666" }))
    .filter(c => c.val > 0);
  const total = counts.reduce((s, c) => s + c.val, 0);

  if (!total) {
    return `<div class="state-box">За ${year} год пока нет завершённых тайтлов с оценкой</div>`;
  }

  const gradeCounts = {};
  for (const r of withGrade) gradeCounts[r.grade] = (gradeCounts[r.grade] || 0) + 1;

  const tagCounts = {};
  for (const r of yearReviews) {
    for (const tag of (r.tags || [])) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);

  const spotlight = statsTopTitlesOfYear(withGrade);

  return `
    <div id="stats-digest">
      ${renderCounters(counts, total, `Итоги ${year}`, "завершено")}
      ${renderDonut(counts, total)}
      ${renderTitleOfYear(spotlight, year)}
      ${renderGradeChart(gradeCounts)}
      ${renderTagCloud(topTags)}
    </div>
    <div class="stat-export-row">
      <button class="admin-add-btn" id="stats-export-btn" data-stat-export-year="${year}">Сохранить как картинку</button>
    </div>
  `;
}

// Лучшая оценка года (минимальный gradeScore — в начале GRADE_ORDER лежат
// лучшие оценки). При нескольких тайтлах с одинаковой лучшей оценкой
// показываем все, но не больше 6, чтобы не раздувать дайджест.
function statsTopTitlesOfYear(withGrade) {
  if (!withGrade.length) return [];
  let best = Infinity;
  for (const r of withGrade) {
    const s = gradeScore(r.grade);
    if (s !== null && s < best) best = s;
  }
  if (best === Infinity) return [];
  return withGrade.filter(r => gradeScore(r.grade) === best).slice(0, 6);
}

function renderTitleOfYear(list, year) {
  if (!list.length) return "";
  const heading = list.length > 1 ? `Тайтлы ${year} года` : `Тайтл ${year} года`;
  const cards = list.map((r, i) => `<div class="year-spotlight-item">${manualCard(r, i)}</div>`).join("");
  return `<section class="stat-section">
    <h2 class="section-title">🏆 ${esc(heading)}</h2>
    <div class="year-spotlight-grid">${cards}</div>
  </section>`;
}

// ── Счётчики ───────────────────────────────────
function renderCounters(counts, total, sectionTitle = "Всего", totalLabel = "тайтлов") {
  const items = counts.map(c => `
    <div class="stat-counter">
      <div class="stat-counter-val" data-target="${c.val}" style="color:${c.color}">0</div>
      <div class="stat-counter-label">${esc(c.label)}</div>
    </div>
  `).join("");

  return `<section class="stat-section">
    <h2 class="section-title">${esc(sectionTitle)}</h2>
    <div class="stat-total">
      <span class="stat-total-num" data-target="${total}">0</span>
      <span class="stat-total-label">${esc(totalLabel)}</span>
    </div>
    <div class="stat-counters">${items}</div>
  </section>`;
}

// ── Пончик ─────────────────────────────────────
function renderDonut(counts, total) {
  if (!total) return "";
  const r = 80, cx = 100, cy = 100;
  const circumference = 2 * Math.PI * r;

  const legend = counts.map(c => `
    <div class="donut-legend-item">
      <span class="donut-dot" style="background:${c.color}"></span>
      <span class="donut-legend-label">${esc(c.label)}</span>
      <span class="donut-legend-val">${c.val}</span>
      <span class="donut-legend-pct">${Math.round(c.val / total * 100)}%</span>
    </div>
  `).join("");

  let accum = 0;
  const segs = counts.map(c => {
    const pct  = c.val / total;
    const dash = pct * circumference;
    const seg  = `<circle cx="${cx}" cy="${cy}" r="${r}"
      fill="none" stroke="${c.color}" stroke-width="16"
      stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}"
      stroke-dashoffset="${(circumference - accum * circumference).toFixed(2)}"
      style="transform:rotate(-90deg);transform-origin:${cx}px ${cy}px"/>`;
    accum += pct;
    return seg;
  }).join("");

  return `<section class="stat-section">
    <h2 class="section-title">Разбивка по типам</h2>
    <div class="stat-donut-wrap">
      <svg viewBox="0 0 200 200" class="stat-donut-svg">
        ${segs}
        <text x="${cx}" y="${cy - 6}" text-anchor="middle" class="donut-center-num">${total}</text>
        <text x="${cx}" y="${cy + 14}" text-anchor="middle" class="donut-center-label">всего</text>
      </svg>
      <div class="donut-legend">${legend}</div>
    </div>
  </section>`;
}

// ── Стековые барчарты по годам ─────────────────
// yearsByType: { year: { type: count } }
function renderStackedBarChart(title, id, yearsByType) {
  const years = Object.keys(yearsByType).sort((a, b) => a - b);
  if (!years.length) return "";

  const totals = years.map(y => Object.values(yearsByType[y]).reduce((s, v) => s + v, 0));
  const max = Math.max(...totals);

  const bars = years.map((year, yi) => {
    const yearTotal = totals[yi];
    const pct = max ? (yearTotal / max * 100) : 0;

    const segments = Object.entries(TYPE_LABELS)
      .map(([key]) => ({ key, val: yearsByType[year][key] || 0, color: TYPE_COLORS[key] || "#666" }))
      .filter(s => s.val > 0)
      .map(s => {
        const segPct = yearTotal ? (s.val / yearTotal * 100).toFixed(2) : 0;
        return `<div class="year-bar-seg"
          style="height:${segPct}%;background:${s.color}"
          title="${TYPE_LABELS[s.key] || s.key}: ${s.val}"></div>`;
      }).join("");

    return `<div class="year-bar-wrap">
      <div class="year-bar-track">
        <div class="year-bar-stack" data-pct="${pct.toFixed(1)}" style="height:0%">
          ${segments}
        </div>
      </div>
      <div class="year-bar-val">${yearTotal}</div>
      <div class="year-bar-label">${esc(String(year))}</div>
    </div>`;
  }).join("");

  return `<section class="stat-section">
    <h2 class="section-title">${esc(title)}</h2>
    <div class="year-bars-wrap" id="${id}">${bars}</div>
  </section>`;
}

// ── Оценки ─────────────────────────────────────
function renderGradeChart(gradeCounts) {
  const total = Object.values(gradeCounts).reduce((s, v) => s + v, 0);
  if (!total) return "";
  const max = Math.max(...Object.values(gradeCounts));

  const bars = GRADE_ORDER.map(key => {
    const g   = GRADES[key];
    if (!g) return "";
    const val = gradeCounts[key] || 0;
    const pct = max ? (val / max * 100) : 0;
    return `<div class="grade-row">
      <div class="grade-row-label" style="color:${g.color}">${esc(g.name)}</div>
      <div class="grade-row-track">
        <div class="grade-row-bar" data-pct="${pct.toFixed(1)}" style="width:0%;background:${g.color}"></div>
      </div>
      <div class="grade-row-val">${val}</div>
    </div>`;
  }).join("");

  return `<section class="stat-section">
    <h2 class="section-title">Шкала послевкусия</h2>
    <div class="grade-bars">${bars}</div>
  </section>`;
}

// ── Облако тегов ───────────────────────────────
function renderTagCloud(topTags) {
  if (!topTags.length) return "";
  const max = topTags[0][1];
  const items = topTags.map(([tag, cnt]) => {
    const info  = TAGS_MAP[tag];
    const cls   = info ? TAG_CAT_CLASS[info.cat] : "rtag-special";
    const scale = 0.8 + (cnt / max) * 0.7;
    return `<span class="rtag ${cls} stat-tag" style="font-size:${scale.toFixed(2)}rem"
      data-tip="${esc(info?.tip || "")}">${esc(tag)} <span class="stat-tag-cnt">${cnt}</span></span>`;
  }).join("");
  return `<section class="stat-section">
    <h2 class="section-title">Частые теги в отзывах</h2>
    <div class="stat-tag-cloud">${items}</div>
  </section>`;
}

// ── Анимации ───────────────────────────────────
function animateCounters() {
  document.querySelectorAll("[data-target]").forEach(el => {
    const target = parseInt(el.dataset.target);
    const dur = 800, start = performance.now();
    function tick(now) {
      const t = Math.min((now - start) / dur, 1);
      el.textContent = Math.round((1 - Math.pow(1 - t, 3)) * target);
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

function animateStackedBars() {
  setTimeout(() => {
    document.querySelectorAll(".year-bar-stack").forEach(el => {
      el.style.transition = "height .6s cubic-bezier(.4,0,.2,1)";
      el.style.height = el.dataset.pct + "%";
    });
    document.querySelectorAll(".grade-row-bar").forEach(el => {
      el.style.transition = "width .6s cubic-bezier(.4,0,.2,1)";
      el.style.width = el.dataset.pct + "%";
    });
  }, 100);
}

// ── Экспорт дайджеста в картинку ───────────────
async function statsExport(year) {
  const btn = document.getElementById("stats-export-btn");
  if (btn) { btn.textContent = "⏳ Создаём…"; btn.disabled = true; }

  let animated = [];
  let prevAnimation = [];
  let proxied = [];

  try {
    const el = document.getElementById("stats-digest");
    if (!el) throw new Error("Дайджест не найден");

    if (typeof html2canvas === "undefined") {
      if (btn) btn.textContent = "⏳ Загружаем библиотеку…";
      await loadHtml2Canvas();
      if (btn) btn.textContent = "⏳ Создаём…";
    }

    // Обложки тянутся с внешних CDN (TMDB/IGDB/AniList и т.д.), которые не
    // отдают CORS-заголовки — html2canvas не может прочитать их пиксели и
    // рисует пустой прямоугольник вместо обложки. Прогоняем такие картинки
    // через серверный прокси-эндпоинт с правильным Access-Control-Allow-Origin,
    // а после скриншота возвращаем оригинальные src обратно.
    //
    // Важно: одного ACAO-заголовка от прокси недостаточно — браузер пометит
    // canvas как "грязный", если у <img> не выставлен crossOrigin ДО загрузки.
    // Без этого html2canvas с useCORS:true всё равно получит тот же чёрный
    // прямоугольник, даже если сама картинка по сети уже подгрузилась.
    const imgs = Array.from(el.querySelectorAll("img"));
    imgs.forEach(img => {
      const src = img.getAttribute("src") || "";
      if (!src || src.startsWith("data:") || src.startsWith(location.origin) || src.startsWith("/")) return;
      proxied.push({ img, orig: src, prevCrossOrigin: img.getAttribute("crossorigin") });
      img.crossOrigin = "anonymous";
      img.src = `/api/proxy-image?url=${encodeURIComponent(src)}`;
    });

    await Promise.all(imgs.map(img =>
      img.complete ? Promise.resolve() : new Promise(res => {
        img.onload = img.onerror = res;
      })
    ));

    // См. tierlist.js tlExport — та же защита от полупрозрачных элементов,
    // если экспорт нажат до того, как доиграли fadeUp-анимации появления.
    animated = Array.from(el.querySelectorAll(".stat-section, .card"));
    prevAnimation = animated.map(node => node.style.animation);
    animated.forEach(node => { node.style.animation = "none"; });
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));

    const canvas = await html2canvas(el, {
      backgroundColor: "#0a0a0c",
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
    });

    const link = document.createElement("a");
    link.download = `itogi-${year}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();

  } catch (err) {
    alert("Не удалось создать картинку 😢\n" + err.message);
  } finally {
    animated.forEach((node, i) => { node.style.animation = prevAnimation[i]; });
    proxied.forEach(({ img, orig, prevCrossOrigin }) => {
      img.src = orig;
      if (prevCrossOrigin === null) img.removeAttribute("crossorigin");
      else img.setAttribute("crossorigin", prevCrossOrigin);
    });
    if (btn) { btn.textContent = "Сохранить как картинку"; btn.disabled = false; }
  }
}
