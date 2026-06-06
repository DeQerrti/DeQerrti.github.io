export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const cookie = req.headers.get("cookie") || "";
  const auth   = cookie.split(";").find(c => c.trim().startsWith("tasteid_auth="));
  const token  = auth?.split("=")[1]?.trim();

  if (token !== process.env.ADMIN_PASSWORD?.trim()) {
    return new Response(JSON.stringify({ error: "Не авторизован" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const review = await req.json();
  if (!review.title || !review.url) {
    return new Response(JSON.stringify({ error: "Нужны title и url" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const repo    = process.env.GITHUB_REPO;
  const ghToken = process.env.GITHUB_TOKEN;
  const apiUrl  = `https://api.github.com/repos/${repo}/contents/reviews.json`;

  try {
    const getRes   = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${ghToken}`, Accept: "application/vnd.github+json" }
    });
    const fileData = await getRes.json();
    const sha      = fileData.sha;
    const current  = JSON.parse(atob(fileData.content.replace(/\n/g, "")));

    current.unshift(review);
    current.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const updated = btoa(unescape(encodeURIComponent(JSON.stringify(current, null, 2))));
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
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }
}
