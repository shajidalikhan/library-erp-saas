import { Types } from 'mongoose';

import { PERMISSIONS, type PermissionName } from '@constants/permissions.constants';
import { ROLES } from '@constants/roles.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { BranchModel } from '@modules/library/library.models';

import type { ReportListQuery } from './reports.validation';

/** Gate: reporting UI (not end-student self-service). */
export function assertReportAccess(user: AuthenticatedUser): void {
  if (user.role === ROLES.SUPER_ADMIN) return;
  if (user.role === ROLES.STUDENT) {
    throw ApiError.forbidden('Student users cannot access admin reports');
  }
  if (
    !user.permissions.includes(PERMISSIONS.REPORT_VIEW) &&
    !user.permissions.includes(PERMISSIONS.ANALYTICS_VIEW)
  ) {
    throw ApiError.forbidden('Insufficient permissions');
  }
}

export function userCan(user: AuthenticatedUser, permission: PermissionName): boolean {
  if (user.role === ROLES.SUPER_ADMIN) return true;
  return user.permissions.includes(permission);
}

export function buildTenantMatch(user: AuthenticatedUser, query: ReportListQuery): Record<string, unknown> {
  if (user.role === ROLES.SUPER_ADMIN) {
    const m: Record<string, unknown> = {};
    if (query.libraryId) m.libraryId = new Types.ObjectId(query.libraryId);
    if (query.branchId) m.branchId = new Types.ObjectId(query.branchId);
    return m;
  }
  if (!user.libraryId) throw ApiError.forbidden('Library context required');
  const m: Record<string, unknown> = { libraryId: new Types.ObjectId(user.libraryId) };
  if (user.branchId) {
    m.branchId = new Types.ObjectId(user.branchId);
  } else if (query.branchId) {
    m.branchId = new Types.ObjectId(query.branchId);
  }
  return m;
}

export async function validateBranchQuery(user: AuthenticatedUser, query: ReportListQuery): Promise<void> {
  if (user.branchId && query.branchId && query.branchId !== user.branchId) {
    throw ApiError.forbidden('Cannot access another branch');
  }
  if (!query.branchId) return;
  const b = await BranchModel.findById(query.branchId).select('libraryId').lean();
  if (!b) throw ApiError.badRequest('Branch not found');
  if (user.role === ROLES.SUPER_ADMIN) {
    if (query.libraryId && String(b.libraryId) !== query.libraryId) {
      throw ApiError.badRequest('Branch does not belong to the selected library');
    }
    return;
  }
  if (!user.libraryId || String(b.libraryId) !== user.libraryId) {
    throw ApiError.forbidden('Invalid branch');
  }
}

export function resolveDateRange(query: ReportListQuery): { from: Date; to: Date } {
  const to = query.toDate ?? new Date();
  if (query.fromDate && query.toDate) {
    return { from: query.fromDate, to: query.toDate };
  }
  if (query.fromDate) {
    return { from: query.fromDate, to };
  }
  const from = new Date(to);
  switch (query.range) {
    case '7d':
      from.setUTCDate(from.getUTCDate() - 7);
      break;
    case '90d':
      from.setUTCDate(from.getUTCDate() - 90);
      break;
    case '365d':
      from.setUTCDate(from.getUTCDate() - 365);
      break;
    case '30d':
    case 'custom':
    default:
      from.setUTCDate(from.getUTCDate() - 30);
      break;
  }
  return { from, to };
}

export const EXPORT_ROW_CAP = 8000;
