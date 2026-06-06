export default async function handler(req, res) {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "Missing query" });

  try {
    const response = await fetch("https://api.hardcover.app/v1/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.HARDCOVER_TOKEN}`
      },
      body: JSON.stringify({ query: decodeURIComponent(query) })
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
