// ══════════════════════════════════════════════
//  REVIEWS — вкладка Отзывы
//  Зависит от: config.js, api.js
// ══════════════════════════════════════════════

// Проверяем авторизацию по куке — только у тебя она есть
function isAdmin() {
  return document.cookie.split(";").some(c => c.trim().startsWith("tasteid_auth="));
}

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

function sourceBtnHtml(url, source) {
  if (!url) return "";
  const label = SOURCE_LABELS[source] || source || "Подробнее";
  if (source === "bluesky") {
    return `<a href="${url}" target="_blank" rel="noopener" class="review-source-link source-bluesky">
      <span class="source-dot-bluesky"></span>${label} →
    </a>`;
  }
  if (source === "teletype") {
    return `<a href="${url}" target="_blank" rel="noopener" class="review-source-link source-teletype">
      <span class="source-dot-teletype"></span>${label} →
    </a>`;
  }
  return `<a href="${url}" target="_blank" rel="noopener" class="review-source-link source-other">
    <span class="source-dot-other"></span>${label} →
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
    ? `<div class="review-waifu"><span class="review-waifu-label">Фавориты:</span> <span>${r.favorites}</span></div>`
    : "";

  const dateStr = r.date
    ? new Date(r.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
    : "";

  const formatYear = [r.format, r.year].filter(Boolean).join(" · ");

  const btn1 = sourceBtnHtml(r.url,  r.source);
  const btn2 = sourceBtnHtml(r.url2, r.source2);
  const sourceButtons = `<div class="source-buttons">${btn1}${btn2}</div>`;

  const gradeHtml = grade
    ? `<div class="review-grade-bar">
        <div class="grade-square" style="background:${grade.color}"></div>
        <div class="grade-chip" style="--gc:${grade.color}" data-tip="${grade.desc}">${grade.name}</div>
        ${sourceButtons}
      </div>`
    : `<div class="review-grade-bar">
        <div style="flex:1"></div>
        ${sourceButtons}
      </div>`;

  // Кнопка карандаша — только для админа
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
          <img src="${r.cover || PH_TALL}" alt="${r.title}" loading="lazy" onerror="this.src='${PH_TALL}'">
        </div>
        <div class="review-body">
          <div class="review-title">${r.title}</div>

          <div class="review-meta-row">
            ${formatYear ? `<span class="review-format">${formatYear}</span>` : ""}
          </div>
          ${dateStr ? `<div class="review-dateline">Ознакомился: <span>${dateStr}</span></div>` : ""}

          ${waifuHtml}

          <div class="review-preview">${r.preview || ""}</div>
        </div>
      </div>

      ${tagsHtml}
      ${gradeHtml}
    </div>
  </div>`;
}
