'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';

import { authService } from '@/modules/auth/auth.service';
import {
  selectAuthStatus,
  selectIsAuthenticated,
  selectUser,
  useAuthStore,
} from '@/store/auth.store';
import { clearSessionCookies } from '@/lib/session-cookies';
import { tokenStorage } from '@/lib/token-storage';
import { ROUTES } from '@/constants/routes';
import { ApiError } from '@/lib/api-error';
import { getPostLoginPath } from '@/lib/post-login';
import type { LoginCredentials } from '@/types/auth';

/**
 * Single composable auth hook for components.
 *
 * - Reads user / status from the Zustand store.
 * - Exposes `login`, `logout` mutations (React Query) so callers
 *   get `isPending`, `error`, `mutateAsync` for free.
 * - On success, mirrors the new user into the store and navigates.
 */
export function useAuth() {
  const router = useRouter();
  const user = useAuthStore(selectUser);
  const status = useAuthStore(selectAuthStatus);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const setUser = useAuthStore((s) => s.setUser);
  const setStatus = useAuthStore((s) => s.setStatus);

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginCredentials) => authService.login(credentials),
    onSuccess: (session) => {
      setUser(session.user);
      router.replace(getPostLoginPath(session.user));
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'TENANT_SUSPENDED') {
        const d = err.details as { suspensionReason?: string | null; libraryName?: string } | undefined;
        const qs = new URLSearchParams();
        if (d?.suspensionReason) qs.set('reason', String(d.suspensionReason));
        if (d?.libraryName) qs.set('library', String(d.libraryName));
        const q = qs.toString();
        router.replace(q ? `/tenant-suspended?${q}` : '/tenant-suspended');
      }
    },
  });

  const logoutMutation = useMutation({
    mutationFn: (allDevices?: boolean) => authService.logout(allDevices ?? false),
    onSettled: async () => {
      tokenStorage.clear();
      await clearSessionCookies();
      setUser(null);
      setStatus('unauthenticated');
      router.replace(ROUTES.LOGIN);
    },
  });

  const refreshMe = useCallback(async () => {
    try {
      const me = await authService.me();
      setUser(me);
      return me;
    } catch (err) {
      if (err instanceof ApiError && (err.statusCode === 401 || err.statusCode === 403)) {
        tokenStorage.clear();
        void clearSessionCookies();
        setUser(null);
        setStatus('unauthenticated');
      }
      throw err;
    }
  }, [setStatus, setUser]);

  return {
    user,
    status,
    isAuthenticated,
    refreshMe,
    login: loginMutation.mutateAsync,
    loginState: loginMutation,
    logout: logoutMutation.mutateAsync,
    logoutState: logoutMutation,
  };
}
