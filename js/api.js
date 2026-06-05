// ════════════════════════════════════════════════
// API — API calls to external services
// ════════════════════════════════════════════════

async function gql(query, variables = {}) {
  const res = await fetch(AL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || "GraphQL error");
  return json.data;
}

async function traktFetch(path) {
  const res = await fetch(`${TRAKT}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "trakt-api-version": "2",
      "trakt-api-key": TRAKT_CLIENT
    }
  });
  if (!res.ok) throw new Error(`Trakt HTTP ${res.status}`);
  return res.json();
}

async function tmdbFetch(path) {
  const cleanPath = path.replace(/^\//, "");
  const res = await fetch(
    `/api/tmdb?path=${encodeURIComponent(cleanPath)}`
  );
  if (!res.ok) {
    throw new Error(`TMDb HTTP ${res.status}`);
  }
  return res.json();
}

function tmdbPoster(path, size = "w342") {
  if (!path) return PH_TALL;
  return `${TMDB_IMG}/${size}${path}`;
}

async function enrichTraktWithPosters(items, type) {
  const BATCH = 20;
  const result = [];
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    await Promise.all(chunk.map(async item => {
      const entry = type === "movie" ? item.movie : item.show;
      const tmdbId = entry?.ids?.tmdb;
      if (!tmdbId) { result.push({ ...item, _poster: null, _type: type }); return; }
      try {
        const detail = await tmdbFetch(`/${type === "movie" ? "movie" : "tv"}/${tmdbId}?language=en-US`);
        result.push({
          ...item,
          _poster: tmdbPoster(detail.poster_path, "w342"),
          _title_ru: detail.title || detail.name || entry.title,
          _year: (detail.release_date || detail.first_air_date || "").slice(0, 4),
          _tmdb_url: `https://www.themoviedb.org/${type === "movie" ? "movie" : "tv"}/${tmdbId}`,
          _type: type
        });
      } catch {
        result.push({ ...item, _poster: null, _type: type });
      }
    }));
  }
  return result;
}

async function fetchTraktWatched(type) {
  const path = type === "movie"
    ? `/users/${TRAKT_USERNAME}/watched/movies?extended=noseasons`
    : `/users/${TRAKT_USERNAME}/watched/shows?extended=noseasons`;
  try { return await traktFetch(path); }
  catch { return []; }
}
