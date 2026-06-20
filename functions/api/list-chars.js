import { json, requireAuth, githubGet } from "../_shared.js";

export async function onRequest(context) {
  const { request, env } = context;

  const authError = await requireAuth(request, env);
  if (authError) return authError;

  const url     = new URL(request.url);
  const folder  = url.searchParams.get("folder");
  const repo    = env.GITHUB_REPO;
  const ghToken = env.GITHUB_TOKEN;

  // Без folder → возвращаем список подпапок из chars/
  // С folder  → возвращаем картинки из chars/{folder}/
  try {
    const res = await githubGet(repo, folder ? `chars/${folder}` : "chars", ghToken);

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
