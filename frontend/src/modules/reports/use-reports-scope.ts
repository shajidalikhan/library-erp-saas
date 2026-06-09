'use client';

import { useMemo, useState } from 'react';

import { ROLES } from '@/constants/permissions';
import { useAuthStore } from '@/store/auth.store';
import { useTenantScope } from '@/hooks/use-tenant-scope';
import type { ReportListParams, ReportRangePreset } from '@/modules/reports/types';

const BRANCH_SCOPED = new Set<string>([
  ROLES.MANAGER,
  ROLES.RECEPTIONIST,
  ROLES.ACCOUNTANT,
  ROLES.SECURITY,
]);

export function useReportsScope() {
  const user = useAuthStore((s) => s.user);
  const isSuper = user?.role === ROLES.SUPER_ADMIN;
  const isBranchScoped = Boolean(user?.role && BRANCH_SCOPED.has(user.role));
  const {
    effectiveLibraryId,
    effectiveBranchId,
    setSuperAdminWorkspace,
    requiresLibrarySelection,
  } = useTenantScope();
  const [range, setRange] = useState<ReportRangePreset>('30d');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [ownerBranchId, setOwnerBranchId] = useState('');

  const libraryId = isSuper ? effectiveLibraryId : user?.libraryId ?? '';
  const branchId = isSuper
    ? effectiveBranchId
    : isBranchScoped
      ? (user?.branchId ?? '')
      : ownerBranchId;

  const setLibraryId = (id: string) => {
    setSuperAdminWorkspace({ libraryId: id, branchId: '' });
  };

  const setBranchId = (id: string) => {
    if (isSuper) {
      setSuperAdminWorkspace({ branchId: id });
    } else {
      setOwnerBranchId(id);
    }
  };

  const listParams: ReportListParams = useMemo(() => {
    const resolvedBranch =
      isSuper ? branchId || undefined : isBranchScoped ? user?.branchId ?? undefined : branchId || undefined;
    const base: ReportListParams = {
      libraryId: isSuper ? libraryId || undefined : user?.libraryId ?? undefined,
      branchId: resolvedBranch,
      range,
    };
    if (range === 'custom' && fromDate && toDate) {
      base.fromDate = `${fromDate}T00:00:00.000Z`;
      base.toDate = `${toDate}T23:59:59.999Z`;
    }
    return base;
  }, [isSuper, isBranchScoped, libraryId, branchId, range, fromDate, toDate, user?.libraryId, user?.branchId]);

  const scopedQueryEnabled =
    !requiresLibrarySelection && (range !== 'custom' || (Boolean(fromDate) && Boolean(toDate)));

  return {
    isSuper,
    libraryId,
    branchId,
    range,
    fromDate,
    toDate,
    setLibraryId,
    setBranchId,
    setRange,
    setFromDate,
    setToDate,
    listParams,
    scopedQueryEnabled,
  };
}
