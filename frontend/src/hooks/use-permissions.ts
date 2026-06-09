'use client';

import { useMemo } from 'react';

import { selectUser, useAuthStore } from '@/store/auth.store';
import type { PermissionName, RoleName } from '@/constants/permissions';
import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  hasRole,
} from '@/lib/permissions';

/**
 * Reactive permission accessors bound to the current user from the store.
 *
 * Always check via `usePermissions().can(...)` in components rather than
 * inspecting `user.role` directly - keeps the code RBAC-driven.
 */
export function usePermissions() {
  const user = useAuthStore(selectUser);

  return useMemo(
    () => ({
      user,
      can: (permission: PermissionName) => hasPermission(user, permission),
      canAll: (permissions: PermissionName[]) => hasAllPermissions(user, permissions),
      canAny: (permissions: PermissionName[]) => hasAnyPermission(user, permissions),
      hasRole: (...roles: RoleName[]) => hasRole(user, ...roles),
    }),
    [user],
  );
}
