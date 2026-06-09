import { Types } from 'mongoose';

import { ROLES } from '@constants/roles.constants';
import { ApiError } from '@utils/ApiError';
import { LibraryModel } from '@modules/library/library.models';
import { BranchModel } from '@modules/library/library.models';
import { StudentModel } from '@modules/students/students.models';
import { SeatModel } from '@modules/seats/seats.models';
import { RoleModel, UserModel } from '@modules/auth/auth.models';
import { resolveSubscriptionPlan } from './subscription-plan-resolve.util';
import { appendPlatformAuditLog } from '@modules/platform/platform-audit.service';
import { logActivity } from '@modules/activity/activity-audit.service';

import { librarySubscriptionService } from './library-subscription.service';
import {
  PLAN_LIMIT_AUDIT_ACTION,
  PLAN_LIMIT_ENTITY,
  PLAN_LIMIT_MESSAGES,
  PLAN_LIMIT_WARNING_RATIO,
  UNLIMITED_PLAN_KEYS,
  USAGE_STATUS,
  type PlanLimitEntity,
  type UsageStatus,
} from './subscription-limit.constants';

export type PlanLimitValue = number | null;

export interface LibraryPlanLimits {
  libraryId: string;
  planCode: string;
  planName: string;
  unlimited: boolean;
  seatCapacity: PlanLimitValue;
  branchLimit: PlanLimitValue;
  staffLimit: PlanLimitValue;
  studentProfileLimit: PlanLimitValue;
  storageLimitMb: PlanLimitValue;
}

export interface LibraryUsageCounts {
  branches: number;
  seats: number;
  staff: number;
  students: number;
  storageUsedMb: number;
}

export interface UsageMetricSnapshot {
  used: number;
  limit: PlanLimitValue;
  remaining: PlanLimitValue;
  status: UsageStatus;
  unlimited: boolean;
}

export interface LibraryUsageSnapshot {
  seats: UsageMetricSnapshot;
  branches: UsageMetricSnapshot;
  staff: UsageMetricSnapshot;
  students: UsageMetricSnapshot;
  storage: UsageMetricSnapshot;
  usageStatus: UsageStatus;
  /** @deprecated flat fields — prefer nested metrics */
  seatCapacity: number;
  seatsUsed: number;
  branchLimit: number;
  branchesUsed: number;
  staffLimit: number;
  staffUsed: number;
  studentProfiles: number;
  studentProfileLimit: number;
  storageLimitMb: number;
  storageUsedMb: number;
}

function planLimitFromCatalog(
  planKey: string,
  raw: number | undefined | null,
): PlanLimitValue {
  if (UNLIMITED_PLAN_KEYS.has(planKey)) return null;
  if (raw == null || raw < 0) return null;
  return raw;
}

export function computeUsageStatus(used: number, limit: PlanLimitValue): UsageStatus {
  if (limit === null) return USAGE_STATUS.NORMAL;
  if (used > limit) return USAGE_STATUS.OVER_LIMIT;
  if (limit > 0 && used / limit >= PLAN_LIMIT_WARNING_RATIO) return USAGE_STATUS.WARNING;
  return USAGE_STATUS.NORMAL;
}

export function buildUsageMetric(used: number, limit: PlanLimitValue): UsageMetricSnapshot {
  const unlimited = limit === null;
  const remaining = unlimited ? null : Math.max(0, limit - used);
  return {
    used,
    limit,
    remaining,
    status: computeUsageStatus(used, limit),
    unlimited,
  };
}

function aggregateUsageStatus(metrics: UsageMetricSnapshot[]): UsageStatus {
  if (metrics.some((m) => m.status === USAGE_STATUS.OVER_LIMIT)) return USAGE_STATUS.OVER_LIMIT;
  if (metrics.some((m) => m.status === USAGE_STATUS.WARNING)) return USAGE_STATUS.WARNING;
  return USAGE_STATUS.NORMAL;
}

async function countStaffUsers(libraryId: Types.ObjectId): Promise<number> {
  const stuRole = await RoleModel.findOne({ name: ROLES.STUDENT }).select('_id').lean();
  if (!stuRole) return 0;
  return UserModel.countDocuments({
    libraryId,
    isActive: true,
    role: { $ne: stuRole._id },
  });
}

class SubscriptionLimitService {
  async getLibraryPlanLimits(libraryId: string): Promise<LibraryPlanLimits> {
    const lib = await LibraryModel.findById(libraryId).select('subscriptionPlan').lean();
    if (!lib) throw ApiError.notFound('Library not found');

    const oid = lib._id as Types.ObjectId;
    await librarySubscriptionService.promoteScheduledIfDue(oid);
    const subRecord = await librarySubscriptionService.ensureFromLibrary(oid);

    const resolved = await resolveSubscriptionPlan({
      planId: subRecord.planId,
      planCode: subRecord.planCode ?? String(lib.subscriptionPlan ?? ''),
      planName: subRecord.planName,
    });

    const unlimited = UNLIMITED_PLAN_KEYS.has(resolved.code);

    return {
      libraryId,
      planCode: resolved.code,
      planName: resolved.displayName,
      unlimited,
      seatCapacity: planLimitFromCatalog(resolved.code, resolved.maxSeats),
      branchLimit: planLimitFromCatalog(resolved.code, resolved.maxBranches),
      staffLimit: planLimitFromCatalog(resolved.code, resolved.maxStaff),
      studentProfileLimit: planLimitFromCatalog(resolved.code, resolved.maxStudents),
      storageLimitMb: planLimitFromCatalog(resolved.code, resolved.storageLimitMb),
    };
  }

  async getCurrentUsage(libraryId: string): Promise<LibraryUsageCounts> {
    const oid = new Types.ObjectId(libraryId);
    const [branches, students, seats, staff] = await Promise.all([
      BranchModel.countDocuments({ libraryId: oid }),
      StudentModel.countDocuments({ libraryId: oid }),
      SeatModel.countDocuments({ libraryId: oid }),
      countStaffUsers(oid),
    ]);
    return {
      branches,
      students,
      seats,
      staff,
      storageUsedMb: 0,
    };
  }

  buildUsageSnapshot(
    usage: LibraryUsageCounts,
    limits: LibraryPlanLimits,
  ): LibraryUsageSnapshot {
    const seats = buildUsageMetric(usage.seats, limits.seatCapacity);
    const branches = buildUsageMetric(usage.branches, limits.branchLimit);
    const staff = buildUsageMetric(usage.staff, limits.staffLimit);
    const students = buildUsageMetric(usage.students, limits.studentProfileLimit);
    const storage = buildUsageMetric(usage.storageUsedMb, limits.storageLimitMb);
    const usageStatus = aggregateUsageStatus([seats, branches, staff, students, storage]);

    return {
      seats,
      branches,
      staff,
      students,
      storage,
      usageStatus,
      seatCapacity: limits.seatCapacity ?? 0,
      seatsUsed: usage.seats,
      branchLimit: limits.branchLimit ?? 0,
      branchesUsed: usage.branches,
      staffLimit: limits.staffLimit ?? 0,
      staffUsed: usage.staff,
      studentProfiles: usage.students,
      studentProfileLimit: limits.studentProfileLimit ?? 0,
      storageLimitMb: limits.storageLimitMb ?? 0,
      storageUsedMb: usage.storageUsedMb,
    };
  }

  async getUsageSnapshot(libraryId: string): Promise<LibraryUsageSnapshot> {
    const [limits, usage] = await Promise.all([
      this.getLibraryPlanLimits(libraryId),
      this.getCurrentUsage(libraryId),
    ]);
    return this.buildUsageSnapshot(usage, limits);
  }

  async isOverLimit(libraryId: string): Promise<boolean> {
    const snap = await this.getUsageSnapshot(libraryId);
    return snap.usageStatus === USAGE_STATUS.OVER_LIMIT;
  }

  private metricForEntity(
    entity: PlanLimitEntity,
    usage: LibraryUsageCounts,
    limits: LibraryPlanLimits,
  ): { used: number; limit: PlanLimitValue } {
    switch (entity) {
      case PLAN_LIMIT_ENTITY.BRANCHES:
        return { used: usage.branches, limit: limits.branchLimit };
      case PLAN_LIMIT_ENTITY.SEATS:
        return { used: usage.seats, limit: limits.seatCapacity };
      case PLAN_LIMIT_ENTITY.STAFF:
        return { used: usage.staff, limit: limits.staffLimit };
      case PLAN_LIMIT_ENTITY.STUDENTS:
        return { used: usage.students, limit: limits.studentProfileLimit };
      default:
        return { used: 0, limit: null };
    }
  }

  async logPlanLimitBlocked(
    libraryId: string,
    entity: PlanLimitEntity,
    usage: LibraryUsageCounts,
    limits: LibraryPlanLimits,
    increment: number,
    actorUserId?: string | null,
  ): Promise<void> {
    const { used, limit } = this.metricForEntity(entity, usage, limits);
    const metadata = {
      entityType: entity,
      currentUsage: used,
      requestedIncrement: increment,
      limit,
      planName: limits.planName,
      planCode: limits.planCode,
    };
    void appendPlatformAuditLog({
      actorUserId: actorUserId ?? null,
      action: PLAN_LIMIT_AUDIT_ACTION,
      entityType: 'LIBRARY',
      entityId: libraryId,
      libraryId,
      metadata,
    }).catch(() => undefined);
    logActivity({
      actorUserId: actorUserId ?? null,
      action: PLAN_LIMIT_AUDIT_ACTION,
      entityType: 'LIBRARY',
      entityId: libraryId,
      libraryId,
      metadata: {
        ...metadata,
        description: PLAN_LIMIT_MESSAGES[entity],
      },
    });
  }

  /**
   * Blocks NEW creates when at or over cap. Downgraded libraries keep existing rows;
   * only additional creates are rejected.
   */
  async validateLimitBeforeCreate(
    entity: PlanLimitEntity,
    libraryId: string,
    options?: { increment?: number; actorUserId?: string | null },
  ): Promise<void> {
    const increment = options?.increment ?? 1;
    const [limits, usage] = await Promise.all([
      this.getLibraryPlanLimits(libraryId),
      this.getCurrentUsage(libraryId),
    ]);

    const { used, limit } = this.metricForEntity(entity, usage, limits);
    if (limit === null) return;

    if (used + increment > limit) {
      await this.logPlanLimitBlocked(libraryId, entity, usage, limits, increment, options?.actorUserId);
      throw ApiError.forbidden(PLAN_LIMIT_MESSAGES[entity], {
        code: 'PLAN_LIMIT_EXCEEDED',
        entityType: entity,
        currentUsage: used,
        limit,
        planName: limits.planName,
        planCode: limits.planCode,
        usageStatus: computeUsageStatus(used, limit),
      });
    }
  }
}

export const subscriptionLimitService = new SubscriptionLimitService();
