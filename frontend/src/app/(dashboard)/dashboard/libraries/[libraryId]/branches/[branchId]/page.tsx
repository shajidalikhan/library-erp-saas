'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Can } from '@/components/auth/can';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS } from '@/constants/permissions';
import {
  branchShiftsRoute,
  libraryBranchEditRoute,
  libraryBranchesRoute,
  libraryDetailRoute,
  ROUTES,
  seatBulkRoute,
  seatGridRoute,
  seatNewRoute,
} from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { ApiError } from '@/lib/api-error';
import { libraryApi } from '@/modules/library/library.service';
import { libraryQueryKeys } from '@/modules/library/library-query-keys';

export default function BranchDetailPage() {
  const params = useParams<{ libraryId: string; branchId: string }>();
  const { libraryId, branchId } = params;
  const { can } = usePermissions();

  const { data: branch, isLoading, error } = useQuery({
    queryKey: libraryQueryKeys.branch(libraryId, branchId),
    queryFn: () => libraryApi.getBranch(libraryId, branchId),
    enabled: Boolean(libraryId && branchId) && can(PERMISSIONS.BRANCH_READ),
  });

  if (!can(PERMISSIONS.BRANCH_READ)) {
    return <EmptyState title="No access" description="You cannot view this branch." />;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3 max-w-md" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !branch) {
    const msg = error instanceof ApiError ? error.message : 'Branch not found';
    return <EmptyState title="Unable to load branch" description={msg} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={branch.branchName}
        description={`Code ${branch.branchCode} · ${branch.email}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant={branch.active ? 'secondary' : 'outline'}>
              {branch.active ? 'Active' : 'Inactive'}
            </Badge>
            <Can permission={PERMISSIONS.BRANCH_UPDATE}>
              <Button size="sm" variant="outline" asChild>
                <Link href={libraryBranchEditRoute(libraryId, branch._id)}>
                  <Pencil className="mr-2 h-4 w-4" aria-hidden />
                  Edit
                </Link>
              </Button>
            </Can>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Phone:</span> {branch.phone ?? '—'}
            </p>
            <p>
              <span className="font-medium text-foreground">Manager ID:</span>{' '}
              {branch.managerId ?? '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Capacity</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p className="text-3xl font-semibold text-foreground">{branch.totalSeats}</p>
            <p>Total seats configured for this branch.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Operations</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" asChild>
            <Link href={branchShiftsRoute(libraryId, branch._id)}>Shifts</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={ROUTES.SHIFTS}>All shifts</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={seatNewRoute()}>Add seat</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={seatBulkRoute()}>Bulk seats</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={seatGridRoute()}>Occupancy grid</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Address</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>{branch.address || '—'}</p>
          <p>
            {[branch.city, branch.state, branch.pincode].filter(Boolean).join(', ') || '—'}
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
        <Link href={libraryBranchesRoute(libraryId)} className="hover:text-foreground">
          ← All branches
        </Link>
        <Link href={libraryDetailRoute(libraryId)} className="hover:text-foreground">
          Library overview →
        </Link>
      </div>
    </div>
  );
}
