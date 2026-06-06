export const config = { matcher: ["/add", "/add.html"] };

export default function middleware(req) {
  const url  = new URL(req.url);
  const cookie = req.headers.get("cookie") || "";
  const auth = cookie.split(";").find(c => c.trim().startsWith("tasteid_auth="));
  const token = auth?.split("=")[1]?.trim();

  if (token === process.env.ADMIN_PASSWORD) {
    return new Response(null, { status: 200 });
  }

  return Response.redirect(new URL("/login.html", req.url));
}
