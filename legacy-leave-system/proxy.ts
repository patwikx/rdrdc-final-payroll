import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config"; // This should be your lean, Edge-compatible config

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  // Logic to handle redirects for auth pages
  const isAuthRoute = nextUrl.pathname.startsWith("/auth");
  if (isAuthRoute) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/setup", nextUrl));
    }
    return;
  }

  // Protect all routes - always redirect to sign-in if not logged in
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/auth/sign-in", nextUrl));
  }

  // Handle root route - redirect authenticated users to setup
  if (nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/setup", nextUrl));
  }
  
  // --- This is the crucial part for our workaround ---
  // If the user is logged in, add the custom header
  const pathSegments = nextUrl.pathname.split('/').filter(Boolean);
  const businessUnitId = pathSegments[0]; // First segment after root
  const requestHeaders = new Headers(req.headers);
  
  // Only set header if we have a valid businessUnitId (not empty and not special routes)
  if (businessUnitId && !businessUnitId.startsWith('_') && businessUnitId !== 'api' && businessUnitId !== 'auth' && businessUnitId !== 'setup') {
    requestHeaders.set('x-business-unit-id', businessUnitId);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
});

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}