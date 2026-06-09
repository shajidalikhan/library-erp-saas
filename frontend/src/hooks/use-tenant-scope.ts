'use client';

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

import { ROLES } from '@/constants/permissions';
import { useAuthStore } from '@/store/auth.store';
import { useSuperAdminWorkspaceStore } from '@/store/super-admin-workspace.store';

export type TenantScope = {
  effectiveLibraryId: string;
  effectiveBranchId: string;
  requiresLibrarySelection: boolean;
  isSuperAdmin: boolean;
  isTenantUser: boolean;
  /** True when the signed-in user is a branch-scoped staff role. */
  isBranchScopedStaff: boolean;
  setSuperAdminWorkspace: (next: { libraryId?: string; branchId?: string }) => void;
};

const BRANCH_SCOPED = new Set<string>([
  ROLES.MANAGER,
  ROLES.RECEPTIONIST,
  ROLES.ACCOUNTANT,
  ROLES.SECURITY,
]);

/**
 * Resolves which library/branch API calls and filters should use.
 *
 * - SUPER_ADMIN: persisted workspace, then `?libraryId=` / `?branchId=` query string.
 * - Tenant staff: always `currentUser.libraryId` / `currentUser.branchId` (query ignored).
 * - STUDENT: not a tenant operator; portal routes use dedicated hooks.
 */
export function useTenantScope(): TenantScope {
  const user = useAuthStore((s) => s.user);
  const searchParams = useSearchParams();
  const persistedLibraryId = useSuperAdminWorkspaceStore((s) => s.libraryId);
  const persistedBranchId = useSuperAdminWorkspaceStore((s) => s.branchId);
  const setSuperAdminWorkspace = useSuperAdminWorkspaceStore((s) => s.setWorkspace);

  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const isStudent = user?.role === ROLES.STUDENT;
  const isTenantUser = Boolean(user && !isSuperAdmin && !isStudent);
  const isBranchScopedStaff = Boolean(user?.role && BRANCH_SCOPED.has(user.role));

  const queryLibraryId = (searchParams.get('libraryId') ?? '').trim();
  const queryBranchId = (searchParams.get('branchId') ?? '').trim();

  const effectiveLibraryId = useMemo(() => {
    if (isSuperAdmin) return persistedLibraryId.trim() || queryLibraryId || '';
    return (user?.libraryId ?? '').trim();
  }, [isSuperAdmin, persistedLibraryId, queryLibraryId, user?.libraryId]);

  const effectiveBranchId = useMemo(() => {
    if (isSuperAdmin) return persistedBranchId.trim() || queryBranchId || '';
    return (user?.branchId ?? '').trim();
  }, [isSuperAdmin, persistedBranchId, queryBranchId, user?.branchId]);

  const requiresLibrarySelection = isSuperAdmin && !effectiveLibraryId;

  useEffect(() => {
    if (!isSuperAdmin) return;
    if (persistedLibraryId.trim()) return;
    if (!queryLibraryId) return;
    setSuperAdminWorkspace({ libraryId: queryLibraryId, branchId: queryBranchId || '' });
  }, [
    isSuperAdmin,
    persistedLibraryId,
    queryBranchId,
    queryLibraryId,
    setSuperAdminWorkspace,
  ]);

  return {
    effectiveLibraryId,
    effectiveBranchId,
    requiresLibrarySelection,
    isSuperAdmin,
    isTenantUser,
    isBranchScopedStaff,
    setSuperAdminWorkspace,
  };
}
