'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Armchair,
  Grid3x3,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Can } from '@/components/auth/can';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PERMISSIONS, ROLES } from '@/constants/permissions';
import { useSubscriptionUsage } from '@/modules/subscription/hooks/use-subscription-usage';
import { PlanLimitButton } from '@/modules/subscription/components/plan-limit-button';
import {
  seatAssignRoute,
  seatBulkRoute,
  seatDetailRoute,
  seatEditRoute,
  ROUTES,
  seatGridRoute,
  seatNewRoute,
  seatOccupancyRoute,
} from '@/constants/routes';
import { usePreferredBranch } from '@/hooks/use-preferred-branch';
import { useDebounce } from '@/hooks/use-debounce';
import { useLibraryOwnerTenantSync } from '@/hooks/use-sync-library-owner-tenant';
import { useTenantScope } from '@/hooks/use-tenant-scope';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/store/auth.store';
import { ApiError } from '@/lib/api-error';
import { libraryApi } from '@/modules/library/library.service';
import type { SeatListParams } from '@/modules/seats/types';
import { seatApi } from '@/modules/seats/seat.service';
import { seatQueryKeys } from '@/modules/seats/seat-query-keys';
import { SeatStatusBadge } from '@/modules/seats/components/seat-status-badge';
import type { Seat, SeatStatus } from '@/modules/seats/types';
import { seatStatuses } from '@/modules/seats/schemas';

function formatShiftOccupancy(seat: Seat): string {
  const rows = seat.shiftAssignments;
  if (!rows?.length) return '—';
  return rows
    .map((a) => {
      const shiftName =
        a.shiftId && typeof a.shiftId === 'object' ? a.shiftId.name : 'Shift';
      const student =
        a.studentId && typeof a.studentId === 'object' ? a.studentId.fullName : '—';
      return `${shiftName}: ${student}`;
    })
    .join(' · ');
}

type ColumnId = 'seat' | 'location' | 'type' | 'shift' | 'status' | 'occupied' | 'actions';

const COLUMN_LABELS: Record<ColumnId, string> = {
  seat: 'Seat',
  location: 'Floor / zone',
  type: 'Type',
  shift: 'Shift occupancy',
  status: 'Status',
  occupied: 'Occupied',
  actions: '',
};

export default function SeatsListPage() {
  const { needsSync, isFetching: tenantSyncing } = useLibraryOwnerTenantSync();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const {
    effectiveLibraryId,
    effectiveBranchId,
    requiresLibrarySelection,
    isSuperAdmin: isSuper,
    setSuperAdminWorkspace,
    isTenantUser,
  } = useTenantScope();
  const { canAny } = usePermissions();
  const { canCreate } = useSubscriptionUsage(effectiveLibraryId ?? undefined);

  const canList = canAny([PERMISSIONS.SEAT_READ, PERMISSIONS.SEAT_OCCUPANCY_READ]);

  const [libSearch, setLibSearch] = useState('');
  const debouncedLibSearch = useDebounce(libSearch, 300);

  const tenantBranchForSeats =
    user?.role === ROLES.MANAGER || user?.role === ROLES.RECEPTIONIST ? (user?.branchId ?? '') : '';

  const tenantLibraryForSeats = !isSuper ? (user?.libraryId ?? '') : '';

  const { data: tenantBranches } = useQuery({
    queryKey: ['seats-tenant-branches', tenantLibraryForSeats],
    queryFn: () => libraryApi.listBranches(tenantLibraryForSeats, { limit: 100 }),
    enabled: Boolean(tenantLibraryForSeats) && !isSuper && canList,
  });

  const [ownerBranchId, setOwnerBranchId] = usePreferredBranch(
    tenantLibraryForSeats,
    tenantBranches?.items,
    { fixedBranchId: tenantBranchForSeats || undefined },
  );

  const { data: libs } = useQuery({
    queryKey: ['seats-libs', debouncedLibSearch],
    queryFn: () => libraryApi.listLibraries({ limit: 50, search: debouncedLibSearch || undefined }),
    enabled: isSuper && canList,
  });

  const { data: branches } = useQuery({
    queryKey: ['seats-branches', effectiveLibraryId],
    queryFn: () => libraryApi.listBranches(effectiveLibraryId!, { limit: 100 }),
    enabled: Boolean(effectiveLibraryId) && isSuper && canList,
  });

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState<SeatStatus | ''>('');
  const [floor, setFloor] = useState('');
  const [zone, setZone] = useState('');
  const [occupied, setOccupied] = useState<string>('');
  const [sortBy, setSortBy] = useState('seatNumber');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [visibleCols, setVisibleCols] = useState<Record<ColumnId, boolean>>({
    seat: true,
    location: true,
    type: true,
    shift: true,
    status: true,
    occupied: true,
    actions: true,
  });

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const listParams = useMemo((): SeatListParams | null => {
    if (!canList) return null;
    if (isSuper && !effectiveLibraryId) return null;
    if (!effectiveLibraryId && !isSuper) return null;

    const p: SeatListParams = {
      page,
      limit: 15,
      search: debouncedSearch.trim() || undefined,
      libraryId: isSuper ? effectiveLibraryId : undefined,
      branchId: isSuper
        ? effectiveBranchId || undefined
        : tenantBranchForSeats || ownerBranchId || undefined,
      floor: floor || undefined,
      zone: zone || undefined,
      status: (status || undefined) as SeatListParams['status'],
      occupied:
        occupied === 'true' ? true : occupied === 'false' ? false : undefined,
      sortBy,
      sortOrder,
    };
    return p;
  }, [
    canList,
    isSuper,
    effectiveLibraryId,
    effectiveBranchId,
    page,
    debouncedSearch,
    floor,
    zone,
    status,
    occupied,
    sortBy,
    sortOrder,
    tenantBranchForSeats,
    ownerBranchId,
  ]);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: seatQueryKeys.list(listParams),
    queryFn: () => seatApi.list(listParams!),
    enabled: Boolean(listParams),
  });

  const toggleCol = useCallback((id: ColumnId) => {
    setVisibleCols((v) => ({ ...v, [id]: !v[id] }));
  }, []);

  const onConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      await seatApi.remove(deleteId);
      toast.success('Seat removed');
      setDeleteId(null);
      await qc.invalidateQueries({ queryKey: seatQueryKeys.all });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Delete failed');
    }
  };

  if (!canList) {
    return <p className="text-sm text-muted-foreground">No access to seats.</p>;
  }

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seats"
        description="Library floor plan, assignments, and occupancy."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={ROUTES.SHIFTS}>Shifts</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={seatOccupancyRoute()}>
                <LayoutGrid className="h-4 w-4 mr-1" />
                Occupancy
              </Link>
            </Button>
            <Can permission={PERMISSIONS.SEAT_READ}>
              <Button variant="outline" size="sm" asChild>
                <Link href={seatGridRoute()}>
                  <Grid3x3 className="h-4 w-4 mr-1" />
                  Grid
                </Link>
              </Button>
            </Can>
            <Can permission={PERMISSIONS.SEAT_CREATE}>
              <PlanLimitButton entity="seats" blocked={!canCreate('seats')} size="sm" asChild>
                <Link href={seatNewRoute()}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add seat
                </Link>
              </PlanLimitButton>
            </Can>
            <Can permission={PERMISSIONS.SEAT_BULK_CREATE}>
              <PlanLimitButton entity="seats" blocked={!canCreate('seats')} variant="secondary" size="sm" asChild>
                <Link href={seatBulkRoute()}>Bulk create</Link>
              </PlanLimitButton>
            </Can>
          </div>
        }
      />

      {isSuper ? (
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">Tenant scope</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search libraries…"
              value={libSearch}
              onChange={(e) => setLibSearch(e.target.value)}
            />
            <select
              className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
              value={effectiveLibraryId}
              onChange={(e) => {
                setSuperAdminWorkspace({ libraryId: e.target.value, branchId: '' });
                setPage(1);
              }}
            >
              <option value="">Select library…</option>
              {libs?.items.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.name}
                </option>
              ))}
            </select>
            <select
              className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
              value={effectiveBranchId}
              onChange={(e) => {
                setSuperAdminWorkspace({ branchId: e.target.value });
                setPage(1);
              }}
              disabled={!effectiveLibraryId}
            >
              <option value="">All branches</option>
              {branches?.items.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.branchName} ({b.branchCode})
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      ) : null}

      {!isSuper && !effectiveLibraryId ? (
        <p className="text-sm text-muted-foreground">
          {isTenantUser && needsSync && tenantSyncing
            ? 'Loading your library workspace…'
            : 'Your account is not linked to a library. Open Libraries to finish setup or contact support.'}
        </p>
      ) : requiresLibrarySelection ? (
        <EmptyState
          icon={Armchair}
          title="Select library workspace"
          description="Choose a library above, open Libraries, or add ?libraryId= to the URL. Your selection is remembered for this browser."
        />
      ) : (
        <>
          {!isSuper && tenantBranches?.items && tenantBranches.items.length > 1 && !tenantBranchForSeats ? (
            <Card>
              <CardContent className="pt-6">
                <label className="text-xs text-muted-foreground">Branch</label>
                <select
                  className="mt-1 flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
                  value={ownerBranchId}
                  onChange={(e) => {
                    setOwnerBranchId(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All branches</option>
                  {tenantBranches.items.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.branchName}
                    </option>
                  ))}
                </select>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs text-muted-foreground">Search</label>
                  <Input
                    placeholder="Seat #, zone, notes…"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Status</label>
                  <select
                    className="flex h-10 rounded-md border border-input bg-background px-2 text-sm"
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value as SeatStatus | '');
                      setPage(1);
                    }}
                  >
                    <option value="">All</option>
                    {seatStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Occupied</label>
                  <select
                    className="flex h-10 rounded-md border border-input bg-background px-2 text-sm"
                    value={occupied}
                    onChange={(e) => {
                      setOccupied(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">Any</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Floor</label>
                  <Input value={floor} onChange={(e) => { setFloor(e.target.value); setPage(1); }} placeholder="e.g. 2" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Zone</label>
                  <Input value={zone} onChange={(e) => { setZone(e.target.value); setPage(1); }} />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" type="button">
                      Columns <MoreHorizontal className="h-4 w-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(Object.keys(COLUMN_LABELS) as ColumnId[]).map((id) => (
                      <DropdownMenuCheckboxItem
                        key={id}
                        checked={visibleCols[id]}
                        onCheckedChange={() => toggleCol(id)}
                        disabled={id === 'actions'}
                      >
                        {COLUMN_LABELS[id] || id}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => qc.invalidateQueries({ queryKey: seatQueryKeys.all })}
                >
                  <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Sort</span>
                <select
                  className="rounded border border-input bg-background px-2 py-1"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="seatNumber">Seat #</option>
                  <option value="floor">Floor</option>
                  <option value="zone">Zone</option>
                  <option value="status">Status</option>
                  <option value="createdAt">Created</option>
                </select>
                <select
                  className="rounded border border-input bg-background px-2 py-1"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                >
                  <option value="asc">Asc</option>
                  <option value="desc">Desc</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">
              {error instanceof ApiError ? error.message : 'Could not load seats.'}
            </p>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Armchair}
              title="No seats yet"
              description="Add seat numbers for your branch, then define shifts and use the occupancy grid to assign students."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild>
                    <Link href={seatNewRoute()}>Add seat</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={ROUTES.SHIFTS}>Manage shifts</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={seatGridRoute()}>Open grid</Link>
                  </Button>
                </div>
              }
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleCols.seat ? <TableHead>Seat</TableHead> : null}
                    {visibleCols.location ? <TableHead>Location</TableHead> : null}
                    {visibleCols.type ? <TableHead>Type</TableHead> : null}
                    {visibleCols.shift ? <TableHead>Shift</TableHead> : null}
                    {visibleCols.status ? <TableHead>Status</TableHead> : null}
                    {visibleCols.occupied ? <TableHead>Occupied</TableHead> : null}
                    {visibleCols.actions ? <TableHead className="w-[120px]" /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row: Seat) => (
                    <TableRow key={row._id}>
                      {visibleCols.seat ? (
                        <TableCell>
                          <Link className="font-medium text-primary hover:underline" href={seatDetailRoute(row._id)}>
                            {row.seatNumber}
                          </Link>
                        </TableCell>
                      ) : null}
                      {visibleCols.location ? (
                        <TableCell className="text-muted-foreground text-sm">
                          {row.floor} / {row.zone}
                        </TableCell>
                      ) : null}
                      {visibleCols.type ? <TableCell className="text-sm">{row.seatType}</TableCell> : null}
                      {visibleCols.shift ? (
                        <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                          {formatShiftOccupancy(row)}
                        </TableCell>
                      ) : null}
                      {visibleCols.status ? (
                        <TableCell>
                          <SeatStatusBadge status={row.status} />
                        </TableCell>
                      ) : null}
                      {visibleCols.occupied ? (
                        <TableCell>{row.occupied ? 'Yes' : 'No'}</TableCell>
                      ) : null}
                      {visibleCols.actions ? (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={seatDetailRoute(row._id)}>View</Link>
                              </DropdownMenuItem>
                              <Can permission={PERMISSIONS.SEAT_UPDATE}>
                                <DropdownMenuItem asChild>
                                  <Link href={seatEditRoute(row._id)}>Edit</Link>
                                </DropdownMenuItem>
                              </Can>
                              <Can permission={PERMISSIONS.SEAT_ASSIGN}>
                                <DropdownMenuItem asChild>
                                  <Link href={seatAssignRoute(row._id)}>Assign student</Link>
                                </DropdownMenuItem>
                              </Can>
                              <Can permission={PERMISSIONS.SEAT_DELETE}>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setDeleteId(row._id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </Can>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {pagination && pagination.totalPages > 1 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
               page {pagination.page} of {pagination.totalPages} · {pagination.total} seats
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasPrev}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasNext}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <Dialog open={Boolean(deleteId)} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete seat?</DialogTitle>
            <DialogDescription>This cannot be undone. The seat must be unassigned first.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
