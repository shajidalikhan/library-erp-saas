import { NextResponse, type NextRequest } from 'next/server';

/**
 * Server-side route guard (Edge).
 *
 * Strategy:
 *  - API runs on another origin (e.g. Render). Login sets HttpOnly cookies only
 *    on that host; they are NOT sent to the Vercel domain. Middleware therefore
 *    checks first-party cookies set by `POST /api/auth/session` (same names as
 *    the backend: `access_token`, `refresh_token`).
 *  - The client still uses localStorage + Bearer for API calls; session cookies
 *    only satisfy this middleware + full navigations/RSC fetches to `/dashboard`.
 *
 * Protected route prefix:  /dashboard
 * Guest-only routes:        /login, /forgot-password, /reset-password, /request-demo
 */

const PROTECTED_PREFIXES = ['/dashboard'];
const GUEST_ONLY = ['/login', '/forgot-password', '/reset-password', '/request-demo'];

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

const startsWithAny = (pathname: string, list: string[]) =>
  list.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname === '/tenant-suspended' || pathname.startsWith('/tenant-suspended/')) {
    return NextResponse.next();
  }

  const hasSessionCookie =
    req.cookies.has(ACCESS_COOKIE) || req.cookies.has(REFRESH_COOKIE);

  // Block unauthenticated access to /dashboard/*
  if (startsWithAny(pathname, PROTECTED_PREFIXES) && !hasSessionCookie) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = `?from=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(loginUrl);
  }

  // Bounce already-authenticated users away from guest-only pages.
  if (startsWithAny(pathname, GUEST_ONLY) && hasSessionCookie) {
    const dashUrl = req.nextUrl.clone();
    dashUrl.pathname = '/dashboard';
    dashUrl.search = '';
    return NextResponse.redirect(dashUrl);
  }

  return NextResponse.next();
}

/**
 * Match every route EXCEPT Next.js internals and common static assets.
 * The redirects above only fire on the explicit prefixes; everything else
 * passes through unchanged.
 */
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
