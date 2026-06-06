export const config = { matcher: ["/add", "/add/"] };

export default function middleware(req) {
  const url    = new URL(req.url);
  const cookie = req.headers.get("cookie") || "";
  const auth   = cookie.split(";").find(c => c.trim().startsWith("tasteid_auth="));
  const token  = auth?.split("=")[1]?.trim();

  // Не авторизован — на логин
  if (token !== process.env.ADMIN_PASSWORD?.trim()) {
    return Response.redirect(new URL("/login.html", req.url));
  }

  // Авторизован — показываем add.html
  return Response.redirect(new URL("/add.html", req.url));
}
