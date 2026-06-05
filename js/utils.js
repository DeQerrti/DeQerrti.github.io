function coverUrl(img, sq = false) {
  if (!img) return sq ? PH_SQ : PH_TALL;
  return img.extraLarge || img.large || img.medium || (sq ? PH_SQ : PH_TALL);
}

function mediaTitle(t) {
  return t?.userPreferred || t?.romaji || t?.english || "—";
}

function entryTypeTag(entry) {
  if (entry.media.type === "ANIME") return ["anime", "Аниме"];
  if (NOVEL_FORMATS.includes(entry.media.format)) return ["novel", "Ранобе"];
  return ["manga", "Манга"];
}

function normTitle(s) {
  return (s || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function gradeInlineHtml(info) {
  if (!info) return "";
  const { grade } = info;
  return `<span class="card-grade-inline" style="color:${grade.color}">${grade.name}</span>`;
}

function gradeScore(key) {
  return GRADE_ORDER.indexOf(key);
}
