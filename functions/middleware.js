export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Защищаем только /add и /add.html
  const isProtected =
    url.pathname === "/add" ||
    url.pathname === "/add/" ||
    url.pathname === "/add.html";

  if (!isProtected) return next();

  // Проверяем куку
  const cookie = request.headers.get("cookie") || "";
  const auth   = cookie.split(";").find(c => c.trim().startsWith("tasteid_auth="));
  const token  = auth?.split("=")[1]?.trim();

  if (token !== env.ADMIN_PASSWORD?.trim()) {
    return Response.redirect(new URL("/login.html", request.url), 302);
  }

  return next();
}
