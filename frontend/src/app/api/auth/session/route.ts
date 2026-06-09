import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';

/**
 * Names must match `frontend/src/middleware.ts` and backend `COOKIE_NAMES`.
 */
const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

/** Align with backend JWT defaults (access ~15m, refresh ~7d). */
const ACCESS_MAX_AGE_SEC = 15 * 60;
const REFRESH_MAX_AGE_SEC = 7 * 24 * 60 * 60;

const bodySchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});

function baseCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: string;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };
}

/**
 * POST: store tokens as HttpOnly cookies on **this** host (Vercel).
 * DELETE: clear them (logout / expiry).
 *
 * These are parallel to localStorage + Bearer; they exist so Edge middleware
 * can gate `/dashboard` without reading localStorage. API calls still use
 * Render; cookies are not sent to cross-origin API requests.
 */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: 'Invalid body' }, { status: 422 });
  }

  const { accessToken, refreshToken } = parsed.data;
  const cookieStore = cookies();
  const base = baseCookieOptions();

  cookieStore.set(ACCESS_COOKIE, accessToken, {
    ...base,
    maxAge: ACCESS_MAX_AGE_SEC,
  });
  cookieStore.set(REFRESH_COOKIE, refreshToken, {
    ...base,
    maxAge: REFRESH_MAX_AGE_SEC,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const cookieStore = cookies();
  const base = baseCookieOptions();

  cookieStore.set(ACCESS_COOKIE, '', { ...base, maxAge: 0 });
  cookieStore.set(REFRESH_COOKIE, '', { ...base, maxAge: 0 });

  return NextResponse.json({ success: true });
}
