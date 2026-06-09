'use client';

import { useMemo, useState } from 'react';

import { ROLES } from '@/constants/permissions';
import { useAuthStore } from '@/store/auth.store';
import { useTenantScope } from '@/hooks/use-tenant-scope';
import type { AnalyticsQueryParams, AnalyticsRangePreset } from '@/modules/analytics/types';

export function useAnalyticsScope() {
  const user = useAuthStore((s) => s.user);
  const isSuper = user?.role === ROLES.SUPER_ADMIN;
  const {
    effectiveLibraryId,
    effectiveBranchId,
    setSuperAdminWorkspace,
    requiresLibrarySelection,
  } = useTenantScope();
  const [range, setRange] = useState<AnalyticsRangePreset>('30d');

  const libraryId = isSuper ? effectiveLibraryId : user?.libraryId ?? '';
  const branchId = isSuper ? effectiveBranchId : user?.branchId ?? '';

  const setLibraryId = (id: string) => {
    setSuperAdminWorkspace({ libraryId: id, branchId: '' });
  };

  const setBranchId = (id: string) => {
    setSuperAdminWorkspace({ branchId: id });
  };

  const params: AnalyticsQueryParams = useMemo(
    () => ({
      libraryId: isSuper ? libraryId || undefined : user?.libraryId ?? undefined,
      branchId: isSuper ? branchId || undefined : user?.branchId ?? undefined,
      range,
    }),
    [isSuper, libraryId, branchId, range, user?.libraryId, user?.branchId],
  );

  const scopedQueryEnabled = !requiresLibrarySelection;

  return {
    isSuper,
    libraryId,
    branchId,
    range,
    setLibraryId,
    setBranchId,
    setRange,
    params,
    scopedQueryEnabled,
  };
}
