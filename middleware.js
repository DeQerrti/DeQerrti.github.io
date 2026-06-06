import { NextResponse } from "next/server";

export function middleware(req) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/add")) return NextResponse.next();

  const cookie = req.cookies.get("tasteid_auth");
  if (cookie?.value === process.env.ADMIN_PASSWORD) return NextResponse.next();

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  return NextResponse.redirect(loginUrl);
}

export const config = { matcher: ["/add"] };
