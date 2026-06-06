export const config = { runtime: "edge" };

export default async function handler(req) {
  const url   = new URL(req.url);
  const query = url.searchParams.get("query");

  if (!query) {
    return new Response(JSON.stringify({ error: "Missing query" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const token = process.env.HARDCOVER_TOKEN || "";

  // Временная отладка
  if (url.searchParams.get("debug")) {
    return new Response(JSON.stringify({
      token_start: token.slice(0, 15),
      token_length: token.length
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  try {
    const response = await fetch("https://api.hardcover.app/v1/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token
      },
      body: JSON.stringify({ query: decodeURIComponent(query) })
    });
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
