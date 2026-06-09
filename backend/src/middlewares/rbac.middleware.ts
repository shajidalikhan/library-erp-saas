import type { RequestHandler } from 'express';
import {
  canonicalPermissionName,
  type PermissionName,
} from '@constants/permissions.constants';
import type { RoleName } from '@constants/roles.constants';
import { ROLES } from '@constants/roles.constants';
import { ApiError } from '@utils/ApiError';
import { requireAuthUser } from './auth.middleware';

/**
 * RBAC guards.
 *
 * - `authorize(...permissions)` : require ALL listed permissions.
 * - `authorizeAny(...permissions)` : require ANY ONE of the listed permissions.
 * - `requireRole(...roles)` : restrict to specific roles (use sparingly).
 *
 * SUPER_ADMIN bypasses all permission checks by design.
 */

const normalize = (p: string) => canonicalPermissionName(p);

const hasAll = (have: PermissionName[], need: PermissionName[]): boolean =>
  need.every((p) => have.map(normalize).includes(normalize(p)));

const hasAny = (have: PermissionName[], need: PermissionName[]): boolean =>
  need.some((p) => have.map(normalize).includes(normalize(p)));

export const authorize =
  (...required: PermissionName[]): RequestHandler =>
  (req, _res, next) => {
    const user = requireAuthUser(req.user);
    if (user.role === ROLES.SUPER_ADMIN) return next();

    if (!hasAll(user.permissions, required)) {
      return next(
        ApiError.forbidden(
          'Insufficient permissions',
          { required, missing: required.filter((p) => !user.permissions.includes(p)) },
        ),
      );
    }
    next();
  };

export const authorizeAny =
  (...required: PermissionName[]): RequestHandler =>
  (req, _res, next) => {
    const user = requireAuthUser(req.user);
    if (user.role === ROLES.SUPER_ADMIN) return next();

    if (!hasAny(user.permissions, required)) {
      return next(
        ApiError.forbidden('Insufficient permissions', { requiredAny: required }),
      );
    }
    next();
  };

export const requireRole =
  (...roles: RoleName[]): RequestHandler =>
  (req, _res, next) => {
    const user = requireAuthUser(req.user);
    if (!roles.includes(user.role)) {
      return next(
        ApiError.forbidden('Role not allowed for this resource', { requiredRoles: roles }),
      );
    }
    next();
  };
