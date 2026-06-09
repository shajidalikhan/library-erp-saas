import type { RequestHandler } from 'express';

import type { RoleCapabilityModule } from '@constants/role-capabilities.constants';
import type { PermissionName } from '@constants/permissions.constants';
import { assertCapabilityAccess } from '@/services/capability-enforcement.service';
import { ApiError } from '@utils/ApiError';
import { asyncHandler } from '@utils/asyncHandler';

/** Blocks when role capability module (all actions) is disabled. */
export const requireRoleModule = (module: RoleCapabilityModule): RequestHandler =>
  requireRoleCapability(module, 'view');

/** Enforces subscription + role action + optional RBAC permission. */
export const requireRoleCapability = (
  module: RoleCapabilityModule,
  action: string,
  permission?: PermissionName,
): RequestHandler =>
  asyncHandler(async (req, _res, next) => {
    const user = req.user;
    if (!user) throw ApiError.unauthorized('Authentication required');
    await assertCapabilityAccess(user, {
      module,
      action,
      permission,
      libraryId: user.libraryId,
      auditContext: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      },
    });
    next();
  });
