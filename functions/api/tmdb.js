export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.searchParams.get("path");

  if (!path) {
    return json({ error: "Missing path" }, 400);
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/${path}`,
      {
        headers: {
          Authorization: `Bearer ${env.TMDB_TOKEN}`
        }
      }
    );
    const data = await response.json();
    return json(data, response.status);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
