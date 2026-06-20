import { checkAuth } from "./_shared.js";

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  const isProtected =
    url.pathname === "/add" ||
    url.pathname === "/add/" ||
    url.pathname === "/add.html" ||
    url.pathname === "/favorites-edit" ||
    url.pathname === "/favorites-edit.html" ||
    url.pathname === "/chars-edit" ||
    url.pathname === "/chars-edit.html" ||
    url.pathname === "/reviews-order" ||
    url.pathname === "/reviews-order.html";

  if (!isProtected) return next();

  if (!checkAuth(request, env)) {
    return Response.redirect(new URL("/login.html", request.url), 302);
  }

  return next();
}
