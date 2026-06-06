export async function onRequest(context) {
  const { request, env } = context;
  const url   = new URL(request.url);
  const query = url.searchParams.get("query");

  if (!query) {
    return json({ error: "Missing query" }, 400);
  }

  const token = env.HARDCOVER_TOKEN || "";

  try {
    const response = await fetch("https://api.hardcover.app/v1/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ query: decodeURIComponent(query) })
    });
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
