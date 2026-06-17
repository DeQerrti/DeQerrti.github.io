export async function onRequest(context) {
  const { request, env } = context;

  const cookie = request.headers.get("cookie") || "";
  const auth   = cookie.split(";").find(c => c.trim().startsWith("tasteid_auth="));
  const token  = auth?.split("=")[1]?.trim();
  if (token !== env.ADMIN_PASSWORD?.trim()) {
    return json({ error: "Не авторизован" }, 401);
  }

  const url     = new URL(request.url);
  const folder  = url.searchParams.get("folder");
  const repo    = env.GITHUB_REPO;
  const ghToken = env.GITHUB_TOKEN;

  // Без folder → возвращаем список подпапок из chars/
  // С folder  → возвращаем картинки из chars/{folder}/
  const apiUrl = folder
    ? `https://api.github.com/repos/${repo}/contents/chars/${folder}`
    : `https://api.github.com/repos/${repo}/contents/chars`;

  try {
    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "TasteID-App",
      },
    });

    if (!res.ok) {
      if (res.status === 404) return json(folder ? { files: [] } : { folders: [] });
      const errText = await res.text();
      return json({ error: `GitHub GET failed: ${res.status} — ${errText}` }, 500);
    }

    const items = await res.json();

    if (!folder) {
      const folders = items
        .filter(item => item.type === "dir")
        .map(item => item.name)
        .sort();
      return json({ folders });
    }

    const files = items
      .filter(item => item.type === "file" && /\.(png|jpg|jpeg|webp|gif)$/i.test(item.name))
      .map(item => ({
        name: item.name.replace(/\.[^.]+$/, ""),
        url:  item.download_url,
      }));
    return json({ files });

  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
