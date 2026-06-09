'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { useAuthStore, selectAuthStatus, selectUser } from '@/store/auth.store';
import {
  hasAllPermissions,
  hasAnyPermission,
  hasRole,
} from '@/lib/permissions';
import { ROUTES } from '@/constants/routes';
import type { PermissionName, RoleName } from '@/constants/permissions';

interface RouteGuardProps {
  permissions?: PermissionName[];
  requireAll?: boolean;
  roles?: RoleName[];
  children: React.ReactNode;
}

/**
 * Client-side route guard for authenticated routes.
 *
 * Behaviour:
 *  - While `status === 'idle' | 'loading'`: show a spinner.
 *  - If unauthenticated: redirect to /login with `?from=<currentPath>`.
 *  - If authenticated but missing perms/role: redirect to /dashboard.
 *
 * Used inside the `(dashboard)` layout; pair with the Next.js `middleware.ts`
 * cookie-based guard for an additional server-side check.
 */
export function RouteGuard({
  permissions,
  requireAll,
  roles,
  children,
}: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAuthStore(selectAuthStatus);
  const user = useAuthStore(selectUser);

  useEffect(() => {
    if (status === 'idle' || status === 'loading') return;

    if (status === 'unauthenticated' || !user) {
      const search = pathname && pathname !== ROUTES.DASHBOARD ? `?from=${encodeURIComponent(pathname)}` : '';
      router.replace(`${ROUTES.LOGIN}${search}`);
      return;
    }

    if (roles && roles.length > 0 && !hasRole(user, ...roles)) {
      router.replace(ROUTES.DASHBOARD);
      return;
    }

    if (permissions && permissions.length > 0) {
      const ok = requireAll
        ? hasAllPermissions(user, permissions)
        : hasAnyPermission(user, permissions);
      if (!ok) {
        router.replace(ROUTES.DASHBOARD);
      }
    }
  }, [status, user, pathname, router, permissions, requireAll, roles]);

  if (status !== 'authenticated' || !user) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  // Permission re-check on render to avoid a flash of protected content.
  if (roles && roles.length > 0 && !hasRole(user, ...roles)) return null;
  if (permissions && permissions.length > 0) {
    const ok = requireAll
      ? hasAllPermissions(user, permissions)
      : hasAnyPermission(user, permissions);
    if (!ok) return null;
  }

  return <>{children}</>;
}
