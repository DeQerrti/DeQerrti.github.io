// ══════════════════════════════════════════════
//  STATS — вкладка Статистика
//  Читает только из reviews.json
//  Зависит от: config.js, api.js, cards.js
// ══════════════════════════════════════════════

async function loadStats() {
  if (loading.stats) return;
  loading.stats = true;

  const box = document.getElementById("tab-stats");
  box.innerHTML = `<div class="state-box"><div class="spinner"></div>Считаем…</div>`;

  try {
    await fetchReviews();
    renderStats();
  } catch (err) {
    box.innerHTML = `<div class="state-box">Ошибка: ${esc(err.message)}</div>`;
  } finally {
    loading.stats = false;
  }
}

function renderStats() {
  const box     = document.getElementById("tab-stats");
  const reviews = cache.reviews || [];

  const completed = reviews.filter(r =>
    r.status === "completed" || (!r.status && (r.preview || r.grade))
  );

  // ── Счётчики по типам ──────────────────────────
  const TYPE_LABELS = {
    anime:   "Аниме",
    manga:   "Манга",
    manhwa:  "Манхва",
    manhua:  "Маньхуа",
    novel:   "Ранобэ",
    movie:   "Фильмы",
    show:    "Сериалы",
    dorama:  "Дорамы",
    book:    "Книги",
    game:    "Игры",
    gacha:   "Гача",
  };

  const typeCounts = {};
  for (const r of completed) {
    const t = r.type || "anime";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }

  const counts = Object.entries(TYPE_LABELS)
    .map(([key, label]) => ({ label, val: typeCounts[key] || 0 }))
    .filter(c => c.val > 0);

  const total = counts.reduce((s, c) => s + c.val, 0);

  // ── По годам просмотра ─────────────────────────
  const watchYears = {};
  for (const r of completed) {
    const raw = r.date_end || r.date_start || r.date;
    const y   = raw ? new Date(raw).getFullYear() : null;
    if (y) watchYears[y] = (watchYears[y] || 0) + 1;
  }

  // ── По годам выхода ────────────────────────────
  const releaseYears = {};
  for (const r of completed) {
    const y = parseInt(r.year);
    if (y) releaseYears[y] = (releaseYears[y] || 0) + 1;
  }

  // ── Оценки ─────────────────────────────────────
  const gradeCounts = {};
  for (const r of reviews) {
    if (r.grade) gradeCounts[r.grade] = (gradeCounts[r.grade] || 0) + 1;
  }

  // ── Теги ───────────────────────────────────────
  const tagCounts = {};
  for (const r of reviews) {
    for (const tag of (r.tags || [])) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  box.innerHTML = `
    ${renderCounters(counts, total)}
    ${renderDonut(counts, total)}
    ${renderWatchYearChart(watchYears)}
    ${renderReleaseYearChart(releaseYears)}
    ${renderGradeChart(gradeCounts)}
    ${renderTagCloud(topTags)}
  `;

  animateCounters();
  animateBars();
}

// ── Счётчики ───────────────────────────────────
function renderCounters(counts, total) {
  const items = counts.map(c => `
    <div class="stat-counter">
      <div class="stat-counter-val" data-target="${c.val}">0</div>
      <div class="stat-counter-label">${esc(c.label)}</div>
    </div>
  `).join("");

  return `<section class="stat-section">
    <h2 class="section-title">Всего</h2>
    <div class="stat-total">
      <span class="stat-total-num" data-target="${total}">0</span>
      <span class="stat-total-label">тайтлов</span>
    </div>
    <div class="stat-counters">${items}</div>
  </section>`;
}

// ── Пончик ─────────────────────────────────────
function renderDonut(counts, total) {
  if (!total) return "";
  const colors = ["#8b1a1a","#c0392b","#d4a017","#2d8a4e","#2563a8","#7c3aed","#706860","#4a8c5c","#b87333","#5a7a9a"];
  const r = 80, cx = 100, cy = 100;
  const circumference = 2 * Math.PI * r;

  const legend = counts.map((c, i) => `
    <div class="donut-legend-item">
      <span class="donut-dot" style="background:${colors[i % colors.length]}"></span>
      <span class="donut-legend-label">${esc(c.label)}</span>
      <span class="donut-legend-val">${c.val}</span>
      <span class="donut-legend-pct">${Math.round(c.val / total * 100)}%</span>
    </div>
  `).join("");

  let accum = 0;
  const segs = counts.map((c, i) => {
    const pct  = c.val / total;
    const dash = pct * circumference;
    const seg  = `<circle cx="${cx}" cy="${cy}" r="${r}"
      fill="none" stroke="${colors[i % colors.length]}" stroke-width="16"
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

// ── Барчарты по годам ──────────────────────────
function renderWatchYearChart(yearData) {
  return renderBarChart("По годам просмотра", "watch-bars", yearData);
}
function renderReleaseYearChart(yearData) {
  return renderBarChart("По годам выхода", "release-bars", yearData);
}

function renderBarChart(title, id, yearData) {
  const sorted = Object.entries(yearData).sort((a, b) => a[0] - b[0]);
  if (!sorted.length) return "";
  const max = Math.max(...sorted.map(([,v]) => v));
  const bars = sorted.map(([year, val]) => {
    const pct = max ? (val / max * 100) : 0;
    return `<div class="year-bar-wrap">
      <div class="year-bar-track">
        <div class="year-bar" data-pct="${pct.toFixed(1)}" style="height:0%"></div>
      </div>
      <div class="year-bar-val">${val}</div>
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

// ── Облако тегов ────────────────────────────────
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

function animateBars() {
  setTimeout(() => {
    document.querySelectorAll(".year-bar").forEach(el => {
      el.style.transition = "height .6s cubic-bezier(.4,0,.2,1)";
      el.style.height = el.dataset.pct + "%";
    });
    document.querySelectorAll(".grade-row-bar").forEach(el => {
      el.style.transition = "width .6s cubic-bezier(.4,0,.2,1)";
      el.style.width = el.dataset.pct + "%";
    });
  }, 100);
}
