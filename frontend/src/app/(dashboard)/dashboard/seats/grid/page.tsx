'use client';



import Link from 'next/link';

import { useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';



import { PageHeader } from '@/components/common/page-header';

import { Button } from '@/components/ui/button';

import { Card, CardContent } from '@/components/ui/card';

import { Skeleton } from '@/components/ui/skeleton';

import { PERMISSIONS, ROLES } from '@/constants/permissions';

import { ROUTES } from '@/constants/routes';

import { useDebounce } from '@/hooks/use-debounce';

import { useLibraryOwnerTenantSync } from '@/hooks/use-sync-library-owner-tenant';

import { usePreferredBranch } from '@/hooks/use-preferred-branch';

import { useTenantScope } from '@/hooks/use-tenant-scope';

import { usePermissions } from '@/hooks/use-permissions';

import { useAuthStore } from '@/store/auth.store';

import { libraryApi } from '@/modules/library/library.service';

import { seatApi } from '@/modules/seats/seat.service';

import { SeatSetupEmptyState } from '@/modules/seats/components/seat-setup-empty-state';

import { ShiftOccupancyGrid } from '@/modules/seats/components/shift-occupancy-grid';



export default function SeatGridPage() {

  const { needsSync, isFetching: tenantSyncing } = useLibraryOwnerTenantSync();

  const user = useAuthStore((s) => s.user);

  const {

    effectiveLibraryId,

    effectiveBranchId,

    isSuperAdmin: isSuper,

    setSuperAdminWorkspace,

    isTenantUser,

  } = useTenantScope();

  const { can } = usePermissions();

  const queryClient = useQueryClient();



  const [libSearch, setLibSearch] = useState('');

  const debouncedLibSearch = useDebounce(libSearch, 300);

  const [floor, setFloor] = useState('');

  const [zone, setZone] = useState('');



  const tenantLibraryId = user?.libraryId ?? '';

  const libraryId = isSuper ? effectiveLibraryId : tenantLibraryId;

  const fixedBranchId =

    user?.role === ROLES.MANAGER || user?.role === ROLES.RECEPTIONIST

      ? (user?.branchId ?? '')

      : isSuper

        ? effectiveBranchId

        : '';



  const { data: libs } = useQuery({

    queryKey: ['grid-libs', debouncedLibSearch],

    queryFn: () => libraryApi.listLibraries({ limit: 50, search: debouncedLibSearch || undefined }),

    enabled: isSuper && can(PERMISSIONS.SEAT_READ),

  });



  const { data: branches } = useQuery({

    queryKey: ['grid-branches', libraryId],

    queryFn: () => libraryApi.listBranches(libraryId!, { limit: 100 }),

    enabled: Boolean(libraryId) && can(PERMISSIONS.SEAT_READ),

  });



  const [tenantBranchId, setTenantBranchId] = usePreferredBranch(libraryId, branches?.items, {

    fixedBranchId: fixedBranchId || undefined,

  });



  const effectiveBranchQuery = isSuper ? effectiveBranchId || tenantBranchId : tenantBranchId;



  const {

    data: grid,

    isLoading,

    isFetching,

    refetch,

  } = useQuery({

    queryKey: ['seat-grid', effectiveBranchQuery, floor, zone],

    queryFn: () =>

      seatApi.grid({

        branchId: effectiveBranchQuery!,

        floor: floor || undefined,

        zone: zone || undefined,

      }),

    enabled: Boolean(effectiveBranchQuery) && can(PERMISSIONS.SEAT_READ),

  });

  /** Unfiltered grid for floor/zone filter options — avoids dropdowns shrinking when a filter is applied. */
  const { data: filterOptionsGrid } = useQuery({

    queryKey: ['seat-grid-options', effectiveBranchQuery],

    queryFn: () => seatApi.grid({ branchId: effectiveBranchQuery! }),

    enabled: Boolean(effectiveBranchQuery) && can(PERMISSIONS.SEAT_READ),

    staleTime: 60_000,

  });

  const floors = [

    ...new Set((filterOptionsGrid?.seats ?? []).map((s) => s.floor).filter(Boolean)),

  ].sort();

  const zones = [

    ...new Set(

      (filterOptionsGrid?.seats ?? [])

        .filter((s) => !floor || s.floor === floor)

        .map((s) => s.zone)

        .filter(Boolean),

    ),

  ].sort();



  if (!can(PERMISSIONS.SEAT_READ)) {

    return <p className="text-sm text-muted-foreground">Grid requires seat.read.</p>;

  }



  return (

    <div className="space-y-6">

      <PageHeader

        title="Seat occupancy"

        description="Shift-wise seat sharing — assign morning and evening students on the same seat when timings allow."

        actions={

          <div className="flex flex-wrap gap-2">

            <Button variant="outline" size="sm" asChild>

              <Link href={ROUTES.SHIFTS}>Manage shifts</Link>

            </Button>

            <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>

              Refresh

            </Button>

            <Button variant="outline" size="sm" asChild>

              <Link href={ROUTES.SEATS}>Table view</Link>

            </Button>

          </div>

        }

      />



      {isSuper ? (

        <Card>

          <CardContent className="space-y-3 pt-6">

            <input

              className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"

              placeholder="Search libraries…"

              value={libSearch}

              onChange={(e) => setLibSearch(e.target.value)}

            />

            <div className="flex flex-wrap gap-3">

              <select

                className="h-10 rounded-md border border-input bg-background px-3 text-sm"

                value={effectiveLibraryId}

                onChange={(e) => setSuperAdminWorkspace({ libraryId: e.target.value, branchId: '' })}

              >

                <option value="">Library…</option>

                {libs?.items.map((l) => (

                  <option key={l._id} value={l._id}>

                    {l.name}

                  </option>

                ))}

              </select>

              <select

                className="h-10 rounded-md border border-input bg-background px-3 text-sm"

                value={effectiveBranchId}

                onChange={(e) => setSuperAdminWorkspace({ branchId: e.target.value })}

                disabled={!effectiveLibraryId}

              >

                <option value="">Branch…</option>

                {branches?.items.map((b) => (

                  <option key={b._id} value={b._id}>

                    {b.branchName}

                  </option>

                ))}

              </select>

            </div>

          </CardContent>

        </Card>

      ) : null}



      {!isSuper && !libraryId ? (

        <p className="text-sm text-muted-foreground">

          {isTenantUser && needsSync && tenantSyncing

            ? 'Loading your library workspace…'

            : 'Your account is not linked to a library.'}

        </p>

      ) : !branches?.items?.length ? (

        <SeatSetupEmptyState />

      ) : !effectiveBranchQuery ? (

        <div className="space-y-3">

          <p className="text-sm text-muted-foreground">Select a branch to load the occupancy grid.</p>

          <select

            className="h-10 max-w-md rounded-md border border-input bg-background px-3 text-sm"

            value={tenantBranchId}

            onChange={(e) => setTenantBranchId(e.target.value)}

          >

            <option value="">Branch…</option>

            {branches.items.map((b) => (

              <option key={b._id} value={b._id}>

                {b.branchName}

              </option>

            ))}

          </select>

        </div>

      ) : (

        <>

          {!isSuper && branches.items.length > 1 ? (

            <Card>

              <CardContent className="pt-6">

                <label className="text-xs font-medium text-muted-foreground">Branch</label>

                <select

                  className="mt-1.5 flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"

                  value={tenantBranchId}

                  onChange={(e) => setTenantBranchId(e.target.value)}

                >

                  {branches.items.map((b) => (

                    <option key={b._id} value={b._id}>

                      {b.branchName} ({b.branchCode})

                    </option>

                  ))}

                </select>

              </CardContent>

            </Card>

          ) : null}



          <div className="flex flex-wrap gap-3">

            <select

              className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"

              value={floor}

              disabled={floors.length === 0}

              onChange={(e) => {

                const nextFloor = e.target.value;

                setFloor(nextFloor);

                setZone((prev) => {

                  if (!prev) return prev;

                  const stillValid = (filterOptionsGrid?.seats ?? []).some(

                    (s) => s.zone === prev && (!nextFloor || s.floor === nextFloor),

                  );

                  return stillValid ? prev : '';

                });

              }}

            >

              {floors.length === 0 ? (

                <option value="">No floors</option>

              ) : (

                <>

                  <option value="">All floors</option>

                  {floors.map((f) => (

                    <option key={f} value={f}>

                      Floor {f}

                    </option>

                  ))}

                </>

              )}

            </select>

            <select

              className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"

              value={zone}

              disabled={zones.length === 0}

              onChange={(e) => setZone(e.target.value)}

            >

              {zones.length === 0 ? (

                <option value="">No zones</option>

              ) : (

                <>

                  <option value="">All zones</option>

                  {zones.map((z) => (

                    <option key={z} value={z}>

                      {z}

                    </option>

                  ))}

                </>

              )}

            </select>

          </div>

          {isLoading ? (

            <Skeleton className="h-96 w-full rounded-xl" />

          ) : grid && grid.shifts.length && grid.seats.length ? (

            <ShiftOccupancyGrid

              grid={grid}

              branchId={effectiveBranchQuery}

              libraryId={libraryId}

              canAssign={can(PERMISSIONS.SEAT_ASSIGN)}

              onRefresh={() => void queryClient.invalidateQueries({ queryKey: ['seat-grid'] })}

            />

          ) : (

            <SeatSetupEmptyState

              branchId={effectiveBranchQuery}

              hasShifts={(grid?.shifts.length ?? 0) > 0}

              hasSeats={(grid?.seats.length ?? 0) > 0}

            />

          )}

        </>

      )}

    </div>

  );

}


