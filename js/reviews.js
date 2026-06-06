// ══════════════════════════════════════════════
//  REVIEWS — вкладка Отзывы
//  Зависит от: config.js, api.js
// ══════════════════════════════════════════════

async function loadReviews() {
  const data = await fetchReviews();
  if (data.length) {
    renderReviews(data);
  } else {
    document.getElementById("tab-reviews").innerHTML =
      `<div class="state-box">
        <div style="font-size:1.5rem;margin-bottom:.75rem">✦</div>
        Отзывов пока нет.<br>
        <span style="font-size:.85rem;margin-top:.5rem;display:block;font-style:italic">
          Добавь записи в reviews.json
        </span>
      </div>`;
  }
}

function renderReviews(reviews) {
  document.getElementById("tab-reviews").innerHTML = `
    <section class="group">
      <h2 class="section-title">Отзывы</h2>
      <div class="reviews-grid">
        ${reviews.map((r, i) => reviewCard(r, i)).join("")}
      </div>
    </section>`;
}

function reviewCard(r, i) {
  const grade = GRADES[r.grade] || null;

  // Теги
  const tagsHtml = (r.tags || []).length
    ? `<div class="review-tags">
        ${r.tags.map(tag => tagHtml(tag)).join("")}
      </div>`
    : "";

  // Фавориты
  const waifuHtml = r.favorites
    ? `<div class="review-waifu">Фавориты: <span>${r.favorites}</span></div>`
    : "";

  // Дата
  const typeColor  = TYPE_COLORS[r.type] || "#6b5e4a";
  const dateStr    = r.date
    ? new Date(r.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
    : "";
  const isMini = r.source === "bluesky";
const sourceLabel = SOURCE_LABELS[r.source] || r.source || "Подробнее";
const sourceLinkClass = isMini ? "review-source-link source-mini" : "review-source-link";
const sourceLinkInner = isMini
  ? `<span class="review-source-dot" style="background:${typeColor}"></span><span class="source-mini-badge">мини</span> ${sourceLabel} →`
  : `<span class="review-source-dot" style="background:${typeColor}"></span> ${sourceLabel} →`;

const gradeHtml = grade
  ? `<div class="review-grade-bar">
      <div class="grade-square" style="background:${grade.color}"></div>
      <div class="grade-chip" style="--gc:${grade.color}" data-tip="${grade.desc}">
        ${grade.name}
      </div>
      <a href="${r.url}" target="_blank" rel="noopener" class="${sourceLinkClass}">
        ${sourceLinkInner}
      </a>
    </div>`
  : `<div class="review-grade-bar">
      <div style="flex:1"></div>
      <a href="${r.url}" target="_blank" rel="noopener" class="${sourceLinkClass}">
        ${sourceLinkInner}
      </a>
    </div>`;

  return `<div class="review-card"
      style="animation-delay:${Math.min(i * 40, 600)}ms;
             border-top: 2px solid ${grade ? grade.color + "66" : "var(--border2)"}">
    <div class="review-top">
      <div class="review-cover">
        <img src="${r.cover || PH_TALL}" alt="${r.title}" loading="lazy" onerror="this.src='${PH_TALL}'">
      </div>
      <div class="review-body">
        <div class="review-header">
          <div class="review-title">${r.title}</div>
        </div>
        <div class="review-meta-row">
          ${r.format ? `<span class="review-format">${r.format}</span>` : ""}
          ${r.year   ? `<span class="review-date">${r.year}</span>` : ""}
          ${dateStr  ? `<span class="review-date" style="margin-left:auto">${dateStr}</span>` : ""}
        </div>
        ${waifuHtml}
        <div class="review-preview">${r.preview || ""}</div>
      </div>
    </div>
    ${tagsHtml}
    ${gradeHtml}
  </div>`;
}
