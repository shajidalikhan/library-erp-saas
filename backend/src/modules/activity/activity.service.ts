import { Types } from 'mongoose';

import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { buildPaginationMeta, resolvePagination } from '@utils/pagination';
import { UserModel } from '@modules/auth/auth.models';
import { AuditLogModel } from '@modules/platform/audit-log.model';
import { lookupBranchMap, lookupLibraryMap } from '@utils/display-enrichment.util';
import {

  ACTIVITY_TITLES,
  mapAuditActionToType,
  type ActivityEventType,
} from './activity.constants';
import type { RecentActivityQuery } from './activity.validation';

export type RecentActivityItem = {
  id: string;
  type: ActivityEventType;
  title: string;
  description: string;
  actorName: string | null;
  entityLabel: string | null;
  libraryName: string | null;
  branchName: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

function buildActivityFilter(
  user: AuthenticatedUser,
  query?: { libraryId?: string; branchId?: string },
): Record<string, unknown> {
  if (user.role === ROLES.SUPER_ADMIN) {
    const filter: Record<string, unknown> = {};
    if (query?.libraryId) filter.libraryId = new Types.ObjectId(query.libraryId);
    if (query?.branchId) filter.branchId = new Types.ObjectId(query.branchId);
    return filter;
  }
  if (user.role === ROLES.STUDENT) {
    return {
      $or: [
        { actorUserId: new Types.ObjectId(user.id) },
        { 'metadata.studentUserId': user.id },
      ],
    };
  }
  if (!user.libraryId) return { _id: { $exists: false } };
  const filter: Record<string, unknown> = { libraryId: new Types.ObjectId(user.libraryId) };
  if (user.branchId && user.role !== ROLES.LIBRARY_OWNER) {
    filter.branchId = new Types.ObjectId(user.branchId);
  }
  return filter;
}

function canViewActivity(user: AuthenticatedUser): boolean {
  if (user.role === ROLES.SUPER_ADMIN) return true;
  if (user.role === ROLES.STUDENT) return true;
  return (
    user.permissions.includes(PERMISSIONS.ANALYTICS_VIEW) ||
    user.permissions.includes(PERMISSIONS.REPORT_VIEW) ||
    user.permissions.includes(PERMISSIONS.NOTIFICATION_READ)
  );
}

function describeActivity(
  action: string,
  entityType: string,
  metadata: Record<string, unknown>,
): { title: string; description: string; entityLabel: string | null } {
  const type = mapAuditActionToType(action);
  const title = ACTIVITY_TITLES[type] ?? action.replace(/_/g, ' ').toLowerCase();
  const entityLabel =
    (typeof metadata.entityLabel === 'string' && metadata.entityLabel) ||
    (typeof metadata.studentName === 'string' && metadata.studentName) ||
    (typeof metadata.seatNumber === 'string' && `Seat ${metadata.seatNumber}`) ||
    (typeof metadata.branchName === 'string' && metadata.branchName) ||
    (typeof metadata.title === 'string' && metadata.title) ||
    null;
  const description =
    (typeof metadata.description === 'string' && metadata.description) ||
    (typeof metadata.message === 'string' && metadata.message) ||
    (typeof metadata.summary === 'string' && metadata.summary) ||
    `${entityType}${entityLabel ? `: ${entityLabel}` : ''}`;
  return { title, description, entityLabel };
}

class ActivityService {
  async listRecent(user: AuthenticatedUser, query: RecentActivityQuery) {
    if (!canViewActivity(user)) {
      throw ApiError.forbidden('Insufficient permissions');
    }

    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const filter = buildActivityFilter(user, query);

    const [rows, total] = await Promise.all([
      AuditLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLogModel.countDocuments(filter),
    ]);

    const libraryIds = rows.map((r) => r.libraryId).filter(Boolean) as Types.ObjectId[];
    const branchIds = rows.map((r) => r.branchId).filter(Boolean) as Types.ObjectId[];
    const actorIds = rows.map((r) => r.actorUserId).filter(Boolean) as Types.ObjectId[];

    const [libraryMap, branchMap, actors] = await Promise.all([
      lookupLibraryMap(libraryIds),
      lookupBranchMap(branchIds),
      UserModel.find({ _id: { $in: actorIds } }).select('fullName').lean(),
    ]);
    const actorMap = new Map(actors.map((a) => [String(a._id), a.fullName]));

    const items: RecentActivityItem[] = rows.map((row) => {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      const { title, description, entityLabel } = describeActivity(
        row.action,
        row.entityType,
        meta,
      );
      const libKey = row.libraryId ? String(row.libraryId) : '';
      const brKey = row.branchId ? String(row.branchId) : '';
      return {
        id: String(row._id),
        type: mapAuditActionToType(row.action),
        title,
        description,
        actorName: row.actorUserId ? actorMap.get(String(row.actorUserId)) ?? null : null,
        entityLabel,
        libraryName: libKey ? libraryMap.get(libKey)?.libraryName ?? null : null,
        branchName: brKey ? branchMap.get(brKey)?.branchName ?? null : null,
        createdAt: row.createdAt.toISOString(),
        metadata: meta,
      };
    });

    return {
      items,
      meta: { pagination: buildPaginationMeta(total, page, limit) },
    };
  }

}

export const activityService = new ActivityService();
