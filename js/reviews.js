// ════════════════════════════════════════════════
// REVIEWS — Review data handling
// ════════════════════════════════════════════════

async function loadReviewsData() {
  try {
    const res = await fetch("reviews.json");
    if (res.ok) {
      const data = await res.json();
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setCached("reviews", data);
      return data;
    }
  } catch (e) {
    console.error("Failed to load reviews:", e);
  }
  return [];
}

function findReviewForTitle(title) {
  const reviews = getCached("reviews");
  if (!reviews || !title) return null;
  const norm = normTitle(title);
  const found = reviews.find(r => normTitle(r.title) === norm);
  if (!found) return null;
  const grade = GRADES[found.grade] || null;
  const score = gradeScore(found.grade);
  return grade ? { grade, score } : null;
}
