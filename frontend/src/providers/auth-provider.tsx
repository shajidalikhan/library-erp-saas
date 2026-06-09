'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '@/store/auth.store';
import { authService } from '@/modules/auth/auth.service';
import { syncSessionCookies, clearSessionCookies } from '@/lib/session-cookies';
import { tokenStorage } from '@/lib/token-storage';
import { ROUTES } from '@/constants/routes';
import { ApiError } from '@/lib/api-error';

/**
 * App-wide auth bootstrap.
 *
 * Responsibilities:
 *  1. On first mount: if a token exists, fetch `/auth/me` and seed the store.
 *  2. Listen for the `auth:expired` event emitted by the Axios interceptor
 *     (failed refresh) and force a soft logout + redirect to /login.
 *
 * IMPORTANT: This provider must wrap any component that reads `useAuthStore`
 * inside a protected route. It runs once on the client.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const setStatus = useAuthStore((s) => s.setStatus);
  const reset = useAuthStore((s) => s.reset);

  const bootstrappedRef = useRef(false);

  // Bootstrap once on mount.
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    const hasToken = !!tokenStorage.getAccessToken() || !!tokenStorage.getRefreshToken();
    if (!hasToken) {
      setStatus('unauthenticated');
      return;
    }

    setStatus('loading');
    authService
      .me()
      .then(async (user) => {
        const accessToken = tokenStorage.getAccessToken();
        const refreshToken = tokenStorage.getRefreshToken();
        if (accessToken && refreshToken) {
          try {
            await syncSessionCookies({ accessToken, refreshToken });
          } catch {
            /* continue: RouteGuard + API may still work; user can re-login */
          }
        }
        setUser(user);
      })
      .catch(async (err: unknown) => {
        if (err instanceof ApiError && (err.statusCode === 401 || err.statusCode === 403)) {
          tokenStorage.clear();
          await clearSessionCookies();
        }
        reset();
      });
  }, [reset, setStatus, setUser]);

  // Session expiry hook (fired by the Axios interceptor after a failed refresh).
  useEffect(() => {
    const onExpired = () => {
      tokenStorage.clear();
      void clearSessionCookies();
      reset();
      router.replace(ROUTES.LOGIN);
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [reset, router]);

  return <>{children}</>;
}
