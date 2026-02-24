import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow auth-related routes and static assets
  const publicPaths = [
    "/login",
    "/register",
    "/api/auth",
    "/_next",
    "/favicon.ico",
    "/icon.png",
  ];

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Protect API routes — return 401
  if (pathname.startsWith("/api/") && !req.auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Protect pages — redirect to login
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|icon.png).*)",
  ],
};
