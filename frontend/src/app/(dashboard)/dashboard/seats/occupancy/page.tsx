'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS, ROLES } from '@/constants/permissions';
import { ROUTES } from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/store/auth.store';
import { libraryApi } from '@/modules/library/library.service';
import { seatApi } from '@/modules/seats/seat.service';
import { seatQueryKeys } from '@/modules/seats/seat-query-keys';

export default function SeatOccupancyPage() {
  const user = useAuthStore((s) => s.user);
  const isSuper = user?.role === ROLES.SUPER_ADMIN;
  const { canAny } = usePermissions();
  const canView = canAny([PERMISSIONS.SEAT_READ, PERMISSIONS.SEAT_OCCUPANCY_READ]);

  const [selectedLibraryId, setSelectedLibraryId] = useState('');
  const [branchId, setBranchId] = useState('');

  const tenantLibraryId = user?.libraryId ?? '';
  const effectiveLibraryId = isSuper ? selectedLibraryId : tenantLibraryId;

  const { data: libs } = useQuery({
    queryKey: ['occ-libs'],
    queryFn: () => libraryApi.listLibraries({ limit: 50 }),
    enabled: isSuper && canView,
  });

  const { data: branches } = useQuery({
    queryKey: ['occ-branches', effectiveLibraryId],
    queryFn: () => libraryApi.listBranches(effectiveLibraryId, { limit: 100 }),
    enabled: Boolean(effectiveLibraryId) && canView,
  });

  const summaryParams = useMemo(() => {
    if (isSuper) {
      return {
        libraryId: selectedLibraryId || undefined,
        branchId: branchId || undefined,
      };
    }
    return {
      branchId: branchId || undefined,
    };
  }, [isSuper, selectedLibraryId, branchId]);

  const summaryEnabled =
    canView && Boolean(effectiveLibraryId || (!isSuper && tenantLibraryId));

  const { data: summary, isLoading } = useQuery({
    queryKey: seatQueryKeys.occupancy(summaryParams),
    queryFn: () => seatApi.occupancySummary(summaryParams),
    enabled: summaryEnabled,
  });

  if (!canView) {
    return <p className="text-sm text-muted-foreground">No access.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Occupancy"
        description="Live seat utilization snapshot."
        actions={
          <Button variant="outline" asChild>
            <Link href={ROUTES.SEATS}>Seats list</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scope</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {isSuper ? (
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[200px]"
              value={selectedLibraryId}
              onChange={(e) => {
                setSelectedLibraryId(e.target.value);
                setBranchId('');
              }}
            >
              <option value="">Select library…</option>
              {libs?.items.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.name}
                </option>
              ))}
            </select>
          ) : null}
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[200px]"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            disabled={!effectiveLibraryId}
          >
            <option value="">
              {user?.role === ROLES.MANAGER || user?.role === ROLES.RECEPTIONIST
                ? 'Your branch (fixed in API)'
                : 'All branches'}
            </option>
            {branches?.items.map((b) => (
              <option key={b._id} value={b._id}>
                {b.branchName} ({b.branchCode})
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {isLoading || !summary ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Total seats</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold tabular-nums">{summary.total}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Occupied</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold tabular-nums">{summary.occupied}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Assignable available</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold tabular-nums">{summary.availableAssignable}</CardContent>
          </Card>
          {summary.partialSeats != null ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Partially utilized</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold tabular-nums">{summary.partialSeats}</CardContent>
            </Card>
          ) : null}
          {summary.fullyUtilizedSeats != null ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Fully utilized</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold tabular-nums">
                {summary.fullyUtilizedSeats}
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      {summary?.occupiedByShift?.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Occupied by shift</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {summary.occupiedByShift.map((row) => (
              <div key={row.shiftId} className="flex justify-between rounded-md border px-3 py-2 text-sm">
                <span>{row.shiftName}</span>
                <span className="tabular-nums font-medium">{row.occupied}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {summary ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By status</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {Object.entries(summary.byStatus).map(([k, v]) => (
              <div key={k} className="flex justify-between border rounded-md px-3 py-2 text-sm">
                <span>{k}</span>
                <span className="tabular-nums font-medium">{v}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
