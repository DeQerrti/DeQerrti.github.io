export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const cookie = req.headers.cookie || "";
  const auth = cookie.split(";").find(c => c.trim().startsWith("tasteid_auth="));
  const token = auth?.split("=")[1]?.trim();
  if (token !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Не авторизован" });
  }

  const review = req.body;
  if (!review.title || !review.url) {
    return res.status(400).json({ error: "Нужны title и url" });
  }

  const repo    = process.env.GITHUB_REPO;
  const ghToken = process.env.GITHUB_TOKEN;
  const apiUrl  = `https://api.github.com/repos/${repo}/contents/reviews.json`;

  try {
    const getRes  = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${ghToken}`, Accept: "application/vnd.github+json" }
    });
    const fileData = await getRes.json();
    const sha      = fileData.sha;
    const current  = JSON.parse(Buffer.from(fileData.content, "base64").toString("utf8"));

    current.unshift(review);
    current.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const updated = Buffer.from(JSON.stringify(current, null, 2)).toString("base64");
    const putRes  = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: `review: add ${review.title}`, content: updated, sha }),
    });

    if (!putRes.ok) {
      const err = await putRes.json();
      return res.status(500).json({ error: err.message });
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
