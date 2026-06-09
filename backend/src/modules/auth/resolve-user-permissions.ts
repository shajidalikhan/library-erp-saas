import {
  canonicalPermissionName,
  ROLE_PERMISSIONS,
  type PermissionName,
} from '@constants/permissions.constants';
import type { RoleName } from '@constants/roles.constants';

/**
 * Effective permissions for an authenticated user.
 * System roles are unioned with the catalog defaults so stale Role documents
 * (missing newly added permissions) do not block tenant owners after deploy.
 */
export function resolveUserPermissions(
  roleName: string,
  rolePermissions: { name: string }[] | undefined,
): PermissionName[] {
  const fromDb = (rolePermissions ?? []).map((p) => canonicalPermissionName(p.name));
  const catalog = ROLE_PERMISSIONS[roleName as RoleName];
  if (!catalog?.length) return fromDb;
  return [...new Set([...fromDb, ...catalog])];
}
