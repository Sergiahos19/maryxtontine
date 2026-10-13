import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedRoute = pathname.startsWith("/admin") || pathname.startsWith("/dashboard") || pathname.startsWith("/account") || pathname === "/notifications" || pathname.startsWith("/notifications/");
  if (!protectedRoute) return NextResponse.next();

  if (!request.cookies.has("maryx_session")) {
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/account/:path*", "/notifications/:path*"],
};
