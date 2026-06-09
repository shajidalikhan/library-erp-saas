'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PERMISSIONS, ROLES } from '@/constants/permissions';
import { ROUTES, seatGridRoute } from '@/constants/routes';
import { useLibraryOwnerTenantSync } from '@/hooks/use-sync-library-owner-tenant';
import { usePreferredBranch } from '@/hooks/use-preferred-branch';
import { useTenantScope } from '@/hooks/use-tenant-scope';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/store/auth.store';
import { libraryApi } from '@/modules/library/library.service';
import { ShiftManagementPanel } from '@/modules/shifts/components/shift-management-panel';

export default function ShiftsPage() {
  const { needsSync, isFetching: tenantSyncing } = useLibraryOwnerTenantSync();
  const user = useAuthStore((s) => s.user);
  const {
    effectiveLibraryId,
    effectiveBranchId,
    requiresLibrarySelection,
    isSuperAdmin,
    isTenantUser,
  } = useTenantScope();
  const { can } = usePermissions();

  const libraryId = isSuperAdmin ? effectiveLibraryId : user?.libraryId ?? '';
  const fixedBranchId =
    user?.role === ROLES.MANAGER || user?.role === ROLES.RECEPTIONIST
      ? (user?.branchId ?? '')
      : isSuperAdmin && effectiveBranchId
        ? effectiveBranchId
        : '';

  const { data: branches } = useQuery({
    queryKey: ['shifts-branches', libraryId],
    queryFn: () => libraryApi.listBranches(libraryId!, { limit: 100 }),
    enabled: Boolean(libraryId) && can(PERMISSIONS.SHIFT_READ),
  });

  const [localBranchId, setLocalBranchId] = usePreferredBranch(libraryId, branches?.items, {
    fixedBranchId: fixedBranchId || undefined,
  });

  const branchId = fixedBranchId || localBranchId;

  if (!can(PERMISSIONS.SHIFT_READ)) {
    return <p className="text-sm text-muted-foreground">You do not have permission to manage shifts.</p>;
  }

  if (requiresLibrarySelection) {
    return (
      <EmptyState
        title="Select a library"
        description="Use the workspace bar above to choose a library, then manage shifts per branch."
      />
    );
  }

  if (!libraryId) {
    return (
      <p className="text-sm text-muted-foreground">
        {isTenantUser && needsSync && tenantSyncing
          ? 'Loading your library workspace…'
          : 'Your account is not linked to a library.'}
      </p>
    );
  }

  if (!branches?.items?.length) {
    return (
      <EmptyState
        title="Create a branch first"
        description="Shifts are configured per branch. Add a branch, then return here."
        action={
          <Button asChild>
            <Link href={ROUTES.BRANCHES}>Go to branches</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shifts"
        description="Define study timings for each branch. Seats stay neutral — assign students per shift on the occupancy grid."
        actions={
          branchId ? (
            <Link href={seatGridRoute()} className="text-sm font-medium text-primary hover:underline">
              Open seat grid →
            </Link>
          ) : null
        }
      />

      {!fixedBranchId && (branches.items.length > 1 || !branchId) ? (
        <Card>
          <CardContent className="pt-6">
            <label className="text-xs font-medium text-muted-foreground">Branch</label>
            <select
              className="mt-1.5 flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
              value={branchId}
              onChange={(e) => setLocalBranchId(e.target.value)}
            >
              <option value="">Select branch…</option>
              {branches.items.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.branchName} ({b.branchCode})
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      ) : null}

      {branchId ? (
        <ShiftManagementPanel libraryId={libraryId} branchId={branchId} />
      ) : (
        <p className="text-sm text-muted-foreground">Select a branch to manage shifts.</p>
      )}
    </div>
  );
}
