import { json, requireAuth, githubGet } from "../_shared.js";

function isSafeName(name) {
  return typeof name === "string" && name.length > 0 && name.length < 100 && !/[/\\.]/.test(name);
}

// "characters" — исторически хранится в chars/, у остальных коллекций
// папка называется как сам id коллекции (openings/, story-versions/ и т.д.)
function imageBasePath(collection) {
  return !collection || collection === "characters" ? "chars" : collection;
}

export async function onRequest(context) {
  const { request, env } = context;

  const authError = await requireAuth(request, env);
  if (authError) return authError;

  const url        = new URL(request.url);
  const folder     = url.searchParams.get("folder");
  const collection = url.searchParams.get("collection") || "characters";
  const repo       = env.GITHUB_REPO;
  const ghToken    = env.GITHUB_TOKEN;

  if (!isSafeName(collection) || (folder && !isSafeName(folder))) {
    return json({ error: "Недопустимое название коллекции или папки" }, 400);
  }

  const base = imageBasePath(collection);

  try {
    const res = await githubGet(repo, folder ? `${base}/${folder}` : base, ghToken);

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
