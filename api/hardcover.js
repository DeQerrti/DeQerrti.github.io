export default async function handler(req, res) {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "Missing query" });

  try {
    const response = await fetch("https://api.hardcover.app/v1/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": process.env.HARDCOVER_TOKEN
      },
      body: JSON.stringify({ query: decodeURIComponent(query) })
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
export default async function handler(req, res) {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: "Missing query" });

  const token = process.env.HARDCOVER_TOKEN || "";
  
  // Временная отладка — удалить после проверки
  if (req.query.debug) {
    return res.status(200).json({ 
      token_start: token.slice(0, 10),
      token_length: token.length 
    });
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
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
