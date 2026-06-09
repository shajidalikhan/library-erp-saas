import type { PermissionName, RoleName } from '@/constants/permissions';
import { ROLES, canonicalPermissionName } from '@/constants/permissions';
import type { AuthUser } from '@/types/auth';

/**
 * Pure permission/role helpers - no React, no Zustand. Reuse from anywhere.
 * UI code should prefer the {@link useAuth} hook + the `<Can />` component,
 * which compose these helpers.
 */

/** SUPER_ADMIN bypasses every permission check by design. */
const isSuperAdmin = (user: Pick<AuthUser, 'role'> | null): boolean =>
  !!user && user.role === ROLES.SUPER_ADMIN;

const normalizedPermissions = (user: Pick<AuthUser, 'permissions'> | null): PermissionName[] =>
  (user?.permissions ?? []).map(canonicalPermissionName);

export const hasPermission = (
  user: Pick<AuthUser, 'role' | 'permissions'> | null,
  permission: PermissionName,
): boolean => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return normalizedPermissions(user).includes(permission);
};

export const hasAllPermissions = (
  user: Pick<AuthUser, 'role' | 'permissions'> | null,
  permissions: PermissionName[],
): boolean => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  const perms = normalizedPermissions(user);
  return permissions.every((p) => perms.includes(p));
};

export const hasAnyPermission = (
  user: Pick<AuthUser, 'role' | 'permissions'> | null,
  permissions: PermissionName[],
): boolean => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (permissions.length === 0) return true;
  const perms = normalizedPermissions(user);
  return permissions.some((p) => perms.includes(p));
};

export const hasRole = (
  user: Pick<AuthUser, 'role'> | null,
  ...roles: RoleName[]
): boolean => {
  if (!user) return false;
  return roles.includes(user.role);
};
