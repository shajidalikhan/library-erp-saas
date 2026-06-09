'use client';

import { useQuery } from '@tanstack/react-query';

import { billingApi } from '@/modules/billing/billing.service';
import { platformApi } from '@/modules/platform/platform.service';
import { subscriptionQueryKeys } from '@/modules/subscription/subscription-query-keys';
import type {
  PlanLimitEntity,
  SubscriptionUsageSnapshot,
  UsageMetric,
  UsageStatus,
} from '@/modules/subscription/subscription-usage.types';
import { isAtCreateCap } from '@/modules/subscription/plan-limit-messages';
import { ROLES } from '@/constants/permissions';
import { selectUser, useAuthStore } from '@/store/auth.store';

function normalizeUsage(raw: Record<string, unknown> | undefined): SubscriptionUsageSnapshot | null {
  if (!raw) return null;
  const pick = (key: string, flatUsed: number, flatLimit: number | null): UsageMetric => {
    const nested = raw[key] as UsageMetric | undefined;
    if (nested && typeof nested.used === 'number') return nested;
    const limit = flatLimit;
    const used = flatUsed;
    const unlimited = limit === null;
    const remaining = unlimited ? null : Math.max(0, (limit ?? 0) - used);
    let status: UsageMetric['status'] = 'NORMAL';
    if (!unlimited && limit != null) {
      if (used > limit) status = 'OVER_LIMIT';
      else if (limit > 0 && used / limit >= 0.8) status = 'WARNING';
    }
    return { used, limit, remaining, status, unlimited };
  };

  return {
    seats: pick('seats', Number(raw.seatsUsed ?? 0), raw.seatCapacity == null ? null : Number(raw.seatCapacity)),
    branches: pick('branches', Number(raw.branchesUsed ?? 0), raw.branchLimit == null ? null : Number(raw.branchLimit)),
    staff: pick('staff', Number(raw.staffUsed ?? 0), raw.staffLimit == null ? null : Number(raw.staffLimit)),
    students: pick(
      'students',
      Number(raw.studentProfiles ?? 0),
      raw.studentProfileLimit == null ? null : Number(raw.studentProfileLimit),
    ),
    usageStatus: (raw.usageStatus as SubscriptionUsageSnapshot['usageStatus']) ?? undefined,
  };
}

export function useSubscriptionUsage(libraryId?: string | null) {
  const user = useAuthStore(selectUser);
  const resolvedLibraryId = libraryId ?? user?.libraryId ?? null;
  const owner =
    user?.role === ROLES.LIBRARY_OWNER && Boolean(resolvedLibraryId && user.libraryId === resolvedLibraryId);
  const platform = user?.role === ROLES.SUPER_ADMIN && Boolean(resolvedLibraryId);

  const q = useQuery({
    queryKey: owner
      ? subscriptionQueryKeys.ownerSnapshot(resolvedLibraryId!)
      : resolvedLibraryId
        ? subscriptionQueryKeys.librarySnapshot(resolvedLibraryId)
        : ['subscription-usage', 'none'],
    queryFn: async () => {
      if (owner) return billingApi.subscriptionSnapshot();
      if (platform && resolvedLibraryId) return platformApi.subscriptionSnapshot(resolvedLibraryId);
      return null;
    },
    enabled: Boolean(owner || platform),
    staleTime: 30_000,
  });

  const usage = normalizeUsage(q.data?.usage as Record<string, unknown> | undefined);

  const canCreate = (entity: PlanLimitEntity): boolean => {
    if (!usage) return true;
    const metric = usage[entity];
    if (!metric) return true;
    return !isAtCreateCap(metric);
  };

  const blockReason = (entity: PlanLimitEntity): string | null => {
    if (!usage || canCreate(entity)) return null;
    return entity;
  };

  const status = (usage?.usageStatus ?? q.data?.usageStatus) as UsageStatus | undefined;

  return {
    usage,
    usageStatus: status,
    snapshot: q.data as Record<string, unknown> | undefined,
    isLoading: q.isLoading,
    canCreate,
    blockReason,
    refetch: q.refetch,
  };
}
