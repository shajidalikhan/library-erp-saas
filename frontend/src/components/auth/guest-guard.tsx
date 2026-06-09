'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { selectAuthStatus, useAuthStore } from '@/store/auth.store';
import { ROUTES } from '@/constants/routes';

/**
 * Wraps guest-only pages (login, forgot-password, reset-password, request-demo).
 * Authenticated users are bounced back to the dashboard (respecting any
 * `?from=` redirect from the original protected page).
 */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useSearchParams();
  const status = useAuthStore(selectAuthStatus);

  useEffect(() => {
    if (status === 'authenticated') {
      const from = params.get('from');
      router.replace(from && from.startsWith('/') ? from : ROUTES.DASHBOARD);
    }
  }, [status, router, params]);

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (status === 'authenticated') return null;
  return <>{children}</>;
}
