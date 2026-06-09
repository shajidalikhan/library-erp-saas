/**
 * Permissions specifically required by this module's protected endpoints.
 * Re-exported from the central catalog so that adjacent modules can import
 * them from a single, predictable place.
 */
import { PERMISSIONS } from '@constants/permissions.constants';

export const AUTH_PERMISSIONS = {
  USER_READ: PERMISSIONS.USER_READ,
  USER_CREATE: PERMISSIONS.USER_CREATE,
  USER_UPDATE: PERMISSIONS.USER_UPDATE,
  USER_DELETE: PERMISSIONS.USER_DELETE,
  ROLE_READ: PERMISSIONS.ROLE_READ,
  ROLE_MANAGE: PERMISSIONS.ROLE_MANAGE,
} as const;
