// ══════════════════════════════════════════════
//  NOW — вкладка Главная
//  Читает только из reviews.json — без API
//  Зависит от: config.js, api.js, cards.js
// ══════════════════════════════════════════════
const loading = {};
async function loadNow() {
  if (cache.now)   { renderNow(cache.now); return; }
  if (loading.now) return;
  loading.now = true;
  const box = document.getElementById("tab-now");
  try {
    await fetchReviews();
    const reviews = cache.reviews || [];
    const current   = reviews.filter(r => r.status === "current");
    const onhold    = reviews.filter(r => r.status === "onhold");
    const planning  = reviews.filter(r => r.status === "planning");
    const completed = reviews.filter(r =>
      r.status === "completed" || (!r.status && (r.preview || r.grade))
    );
    cache.now = { current, onhold, planning, completed };
    renderNow(cache.now);
  } catch (err) {
    box.innerHTML = `<div class="state-box">
      <div style="font-size:2rem;margin-bottom:.75rem">⚠️</div>
      Ошибка: ${esc(err.message)}
    </div>`;
  } finally {
    loading.now = false;
  }
}
function renderNow({ current, onhold, planning, completed }) {
  const box = document.getElementById("tab-now");
  let html = "";
  // ── В процессе ─────────────────────────────────
  if (current.length) {
    html += `<section class="group">
      <h2 class="section-title">В процессе</h2>
      <div class="grid-now">
        ${current.map((r, i) => manualCard(r, i)).join("")}
      </div>
    </section>`;
  }
  // ── Отложено ───────────────────────────────────
  if (onhold.length) {
    html += `<section class="group">
      <h2 class="section-title">Отложено</h2>
      <div class="grid-now">
        ${onhold.map((r, i) => manualCard(r, i)).join("")}
      </div>
    </section>`;
  }
  // ── Планирую ───────────────────────────────────
  if (planning.length) {
    html += `<section class="group">
      <h2 class="section-title">Планирую</h2>
      <div class="grid-now">
        ${planning.map((r, i) => manualCard(r, i)).join("")}
      </div>
    </section>`;
  }
  // ── Архив — группируем по году ─────────────────
  if (completed.length) {
    const sorted = [...completed].sort((a, b) => {
      const da = new Date(a.date_end || a.date_start || a.date || 0);
      const db = new Date(b.date_end || b.date_start || b.date || 0);
      return db - da;
    });
    const byYear = {};
    for (const r of sorted) {
      const raw = r.date_end || r.date_start || r.date;
      const y   = raw ? new Date(raw).getFullYear() : "—";
      if (!byYear[y]) byYear[y] = [];
      byYear[y].push(r);
    }
    let archiveHtml = "";
    for (const year of Object.keys(byYear).sort((a, b) => b - a)) {
      archiveHtml += `<div class="year-divider">${esc(String(year))}</div>
        <div class="grid-now">
          ${byYear[year].map((r, i) => manualCard(r, i)).join("")}
        </div>`;
    }
    html += `<section class="group">
      <h2 class="section-title">Архив</h2>
      ${archiveHtml}
    </section>`;
  }
  box.innerHTML = html || `<div class="state-box">Список пуст</div>`;
}
