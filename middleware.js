export const config = { matcher: ["/add", "/add/", "/add.html"] };

export default function middleware(req) {
  const url    = new URL(req.url);
  const cookie = req.headers.get("cookie") || "";
  const auth   = cookie.split(";").find(c => c.trim().startsWith("tasteid_auth="));
  const token  = auth?.split("=")[1]?.trim();

  // Не авторизован — редирект на логин
  if (token !== process.env.ADMIN_PASSWORD?.trim()) {
    return Response.redirect(new URL("/login.html", req.url), 302);
  }

  // Авторизован и зашёл на /add или /add/ — редирект на add.html
  if (!url.pathname.endsWith(".html")) {
    return Response.redirect(new URL("/add.html" + url.search, req.url), 302);
  }

  // Авторизован и уже на /add.html — пропускаем запрос как есть
  return new Response(null, { status: 200, headers: { "x-middleware-next": "1" } });
}
