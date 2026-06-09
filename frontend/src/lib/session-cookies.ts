/**
 * Synchronizes auth tokens into **first-party** HttpOnly cookies on the Next.js
 * origin (e.g. Vercel). Middleware checks these cookie names; they are NOT
 * sent on cross-origin requests to the Render API, so we mirror tokens here
 * after login / refresh / bootstrap.
 */

const SESSION_PATH = '/api/auth/session';

export async function syncSessionCookies(tokens: {
  accessToken: string;
  refreshToken: string;
}): Promise<void> {
  if (typeof window === 'undefined') return;

  const res = await fetch(SESSION_PATH, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tokens),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `Session sync failed (${res.status})`);
  }
}

export async function clearSessionCookies(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch(SESSION_PATH, { method: 'DELETE', credentials: 'same-origin' });
  } catch {
    /* best-effort */
  }
}
