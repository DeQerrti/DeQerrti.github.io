export default async function handler(req, res) {
  const { path } = req.query;

  if (!path) {
    return res.status(400).json({
      error: "Missing path"
    });
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/${path}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.TMDB_TOKEN}`
        }
      }
    );

    const data = await response.json();

    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
}
