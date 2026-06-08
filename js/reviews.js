// ══════════════════════════════════════════════
//  REVIEWS — вкладка Отзывы
//  Зависит от: config.js, api.js
// ══════════════════════════════════════════════

function isAdmin() {
  return document.cookie.split(";").some(c => c.trim().startsWith("tasteid_ui="));
}

// ── Состояние фильтров ─────────────────────────
const rvState = {
  type:   "all",
  grade:  "all",
  source: "all",
};

async function loadReviews() {
  const data = await fetchReviews();
  const withReview = data.filter(r => r.preview || r.grade);
  if (withReview.length) {
    renderReviews(withReview);
  } else {
    document.getElementById("tab-reviews").innerHTML =
      `<div class="state-box">
        <div style="font-size:1.5rem;margin-bottom:.75rem">✦</div>
        Отзывов пока нет.
        ${isAdmin() ? `<div style="margin-top:1.5rem"><a href="/add" class="admin-add-btn">+ Добавить отзыв</a></div>` : ""}
      </div>`;
  }
}

function renderReviews(reviews) {
  const types   = [...new Set(reviews.map(r => r.type).filter(Boolean))];
  const grades  = [...new Set(reviews.map(r => r.grade).filter(Boolean))];
  const sources = [...new Set(
    reviews.flatMap(r => [r.source, r.source2]).filter(Boolean)
  )];

  const adminBtn = isAdmin()
    ? `<a href="/add" class="admin-add-btn">+ Добавить отзыв</a>`
    : "";

  const box = document.getElementById("tab-reviews");
  box.innerHTML = `
    <div class="rv-toolbar">
      <div class="rv-filters">
        ${renderRvFilterGroup("type",   "Тип",      types,   TYPE_LABELS,  rvState.type)}
        ${renderRvFilterGroup("grade",  "Оценка",   grades,  gradeLabels(), rvState.grade)}
        ${renderRvFilterGroup("source", "Источник", sources, SOURCE_LABELS, rvState.source)}
      </div>
      ${adminBtn}
    </div>
    <section class="group">
      <div class="reviews-grid" id="rv-grid"></div>
    </section>`;

  bindRvFilters(reviews);
  applyRvFilters(reviews);
}

// Лейблы оценок для фильтра
function gradeLabels() {
  const out = {};
  for (const [key, g] of Object.entries(GRADES)) out[key] = g.name;
  return out;
}

// Рендер одной группы кнопок-фильтров
function renderRvFilterGroup(field, title, values, labelsMap, active) {
  if (!values.length) return "";
  const btns = [
    `<button class="rv-filter-btn${active === "all" ? " active" : ""}" data-field="${field}" data-val="all">Все</button>`,
    ...values.map(v => {
      const label = labelsMap[v] || v;
      return `<button class="rv-filter-btn${active === v ? " active" : ""}" data-field="${field}" data-val="${esc(v)}">${esc(label)}</button>`;
    })
  ].join("");
  return `<div class="rv-filter-group">
    <span class="rv-filter-label">${esc(title)}</span>
    ${btns}
  </div>`;
}

function bindRvFilters(reviews) {
  document.querySelectorAll(".rv-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const field = btn.dataset.field;
      const val   = btn.dataset.val;
      rvState[field] = val;

      document.querySelectorAll(`.rv-filter-btn[data-field="${field}"]`)
        .forEach(b => b.classList.toggle("active", b.dataset.val === val));

      applyRvFilters(reviews);
    });
  });
}

function applyRvFilters(reviews) {
  let filtered = reviews;

  if (rvState.type !== "all") {
    filtered = filtered.filter(r => r.type === rvState.type);
  }
  if (rvState.grade !== "all") {
    filtered = filtered.filter(r => r.grade === rvState.grade);
  }
  if (rvState.source !== "all") {
    filtered = filtered.filter(r =>
      r.source === rvState.source || r.source2 === rvState.source
    );
  }

  const grid = document.getElementById("rv-grid");
  if (!grid) return;

  if (!filtered.length) {
    grid.innerHTML = `<div class="state-box" style="padding:3rem 1rem;grid-column:1/-1">
      Ничего не найдено
    </div>`;
    return;
  }

  grid.innerHTML = filtered.map((r, i) => reviewCard(r, i)).join("");
}

// ── Карточка отзыва ────────────────────────────
function sourceBtnHtml(url, source) {
  if (!url) return "";
  const label = SOURCE_LABELS[source] || source || "Подробнее";
  if (source === "bluesky") {
    return `<a href="${esc(url)}" target="_blank" rel="noopener" class="review-source-link source-bluesky">
      <span class="source-dot-bluesky"></span>${esc(label)} →
    </a>`;
  }
  if (source === "teletype") {
    return `<a href="${esc(url)}" target="_blank" rel="noopener" class="review-source-link source-teletype">
      <span class="source-dot-teletype"></span>${esc(label)} →
    </a>`;
  }
  return `<a href="${esc(url)}" target="_blank" rel="noopener" class="review-source-link source-other">
    <span class="source-dot-other"></span>${esc(label)} →
  </a>`;
}

function reviewCard(r, i) {
  const grade = GRADES[r.grade] || null;

  const tagsHtml = (r.tags || []).length
    ? `<div class="review-tags">
        ${r.tags.map(tag => tagHtml(tag)).join("")}
      </div>`
    : "";

  const waifuHtml = r.favorites
    ? `<div class="review-waifu"><span class="review-waifu-label">Фавориты:</span> <span>${esc(r.favorites)}</span></div>`
    : "";

  const dateRaw = r.date_end || r.date_start || r.date || null;
  const dateStr = dateRaw
    ? new Date(dateRaw).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
    : "";

  const formatYear = [r.format, r.year].filter(Boolean).join(" · ");

  const btn1 = sourceBtnHtml(r.url,  r.source);
  const btn2 = sourceBtnHtml(r.url2, r.source2);
  const sourceButtons = `<div class="source-buttons">${btn1}${btn2}</div>`;

  const gradeHtml = grade
    ? `<div class="review-grade-bar">
        <div class="grade-square" style="background:${grade.color}"></div>
        <div class="grade-chip" style="--gc:${grade.color}" data-tip="${esc(grade.desc)}">${esc(grade.name)}</div>
        ${sourceButtons}
      </div>`
    : `<div class="review-grade-bar">
        <div style="flex:1"></div>
        ${sourceButtons}
      </div>`;

  const editId  = r.id ?? encodeURIComponent(r.title);
  const editBtn = isAdmin()
    ? `<a href="/add?edit=${editId}" class="review-edit-btn" title="Редактировать">✎</a>`
    : "";

  return `<div class="review-card-wrap">
    ${editBtn}
    <div class="review-card"
        style="animation-delay:${Math.min(i * 40, 600)}ms;
               border-top: 2px solid ${grade ? grade.color + "66" : "var(--border2)"}">
      <div class="review-top">
        <div class="review-cover">
          <img src="${esc(r.cover || PH_TALL)}" alt="${esc(r.title)}" loading="lazy" onerror="this.src='${PH_TALL}'">
        </div>
        <div class="review-body">
          <div class="review-title">${esc(r.title)}</div>
          <div class="review-meta-row">
            ${formatYear ? `<span class="review-format">${esc(formatYear)}</span>` : ""}
          </div>
          ${dateStr ? `<div class="review-dateline">Ознакомился: <span>${esc(dateStr)}</span></div>` : ""}
          ${waifuHtml}
          <div class="review-preview">${esc(r.preview || "")}</div>
        </div>
      </div>
      ${tagsHtml}
      ${gradeHtml}
    </div>
  </div>`;
}
