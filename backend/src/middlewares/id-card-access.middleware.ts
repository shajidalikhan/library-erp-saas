import type { RequestHandler } from 'express';

import { PERMISSIONS } from '@constants/permissions.constants';
import { ROLES } from '@constants/roles.constants';
import { ApiError } from '@utils/ApiError';
import { requireAuthUser } from './auth.middleware';

/** Staff permissions or student self-service (enforced again in id-card.service). */
export const authorizeIdCardAccess: RequestHandler = (req, _res, next) => {
  const user = requireAuthUser(req.user);
  if (user.role === ROLES.SUPER_ADMIN) return next();
  if (user.role === ROLES.STUDENT) return next();
  const allowed = [PERMISSIONS.ID_CARD_GENERATE, PERMISSIONS.STUDENT_READ] as const;
  if (allowed.some((p) => user.permissions.includes(p))) return next();
  return next(ApiError.forbidden('Insufficient permissions to access ID cards'));
};
