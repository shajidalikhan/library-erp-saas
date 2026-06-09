'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Can } from '@/components/auth/can';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PERMISSIONS } from '@/constants/permissions';
import {
  libraryBranchDetailRoute,
  libraryBranchEditRoute,
  libraryBranchNewRoute,
  libraryDetailRoute,
} from '@/constants/routes';
import { useDebounce } from '@/hooks/use-debounce';
import { usePermissions } from '@/hooks/use-permissions';
import { ApiError } from '@/lib/api-error';
import { libraryApi, type BranchListParams } from '@/modules/library/library.service';
import { libraryQueryKeys } from '@/modules/library/library-query-keys';
import type { Branch } from '@/modules/library/types';
import { useSubscriptionUsage } from '@/modules/subscription/hooks/use-subscription-usage';
import { useSubscriptionFeatures } from '@/modules/subscription/hooks/use-subscription-features';
import { PlanLimitButton } from '@/modules/subscription/components/plan-limit-button';
import { DeleteBranchDialog } from '@/modules/library/components/delete-branch-dialog';

export default function BranchesListPage() {
  const params = useParams<{ libraryId: string }>();
  const libraryId = params.libraryId;
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const { canCreate, usage } = useSubscriptionUsage(libraryId);
  const { hasFeature } = useSubscriptionFeatures(libraryId);
  const blockNewBranch =
    !canCreate('branches') ||
    (usage != null && usage.branches.used >= 1 && !hasFeature('multi_branch'));

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<BranchListParams['sortBy']>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const listParams = useMemo(
    () =>
      ({
        page,
        limit: 10,
        search: debouncedSearch.trim() || undefined,
        sortBy,
        sortOrder,
        active:
          activeFilter === 'true' ? true : activeFilter === 'false' ? false : undefined,
      }) satisfies BranchListParams,
    [page, debouncedSearch, sortBy, sortOrder, activeFilter],
  );

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: libraryQueryKeys.branches(libraryId, listParams),
    queryFn: () => libraryApi.listBranches(libraryId, listParams),
    enabled: Boolean(libraryId) && can(PERMISSIONS.BRANCH_READ),
  });

  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await libraryApi.deleteBranch(libraryId, deleteTarget._id);
      toast.success('Branch deleted');
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['libraries', libraryId, 'branches'] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  if (!can(PERMISSIONS.BRANCH_READ)) {
    return <EmptyState title="No access" description="You cannot view branches." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branches"
        description="Locations, capacity, and operational contacts for this library."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={libraryDetailRoute(libraryId)}>Library overview</Link>
            </Button>
            <Can permission={PERMISSIONS.BRANCH_CREATE}>
              <PlanLimitButton entity="branches" blocked={blockNewBranch} asChild>
                <Link href={libraryBranchNewRoute(libraryId)}>
                  <Plus className="mr-2 h-4 w-4" aria-hidden />
                  New branch
                </Link>
              </PlanLimitButton>
            </Can>
          </div>
        }
      />

      <Card className="border-border/60 shadow-soft">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-1 flex-col gap-2 sm:max-w-md">
              <label className="text-sm font-medium text-muted-foreground" htmlFor="br-search">
                Search
              </label>
              <Input
                id="br-search"
                placeholder="Name, code, email, city…"
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-muted-foreground">Active</span>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={activeFilter}
                  onChange={(e) => {
                    setPage(1);
                    setActiveFilter(e.target.value);
                  }}
                >
                  <option value="">All</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-muted-foreground">Sort</span>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={`${sortBy}:${sortOrder}`}
                  onChange={(e) => {
                    const [sb, so] = e.target.value.split(':') as [BranchListParams['sortBy'], 'asc' | 'desc'];
                    setSortBy(sb);
                    setSortOrder(so);
                  }}
                >
                  <option value="createdAt:desc">Newest</option>
                  <option value="createdAt:asc">Oldest</option>
                  <option value="branchName:asc">Name A–Z</option>
                  <option value="totalSeats:desc">Seats (high)</option>
                </select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => void refetch()}
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden />
              </Button>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {error instanceof Error ? error.message : 'Failed to load branches'}
            </div>
          ) : null}

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data?.items.length ? (
            <EmptyState
              title="No branches"
              description="Create your first branch to start assigning seats and staff."
              action={
                <Can permission={PERMISSIONS.BRANCH_CREATE}>
                  <Button asChild>
                    <Link href={libraryBranchNewRoute(libraryId)}>Create branch</Link>
                  </Button>
                </Can>
              }
            />
          ) : (
            <div className="rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Seats</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[72px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((b) => (
                    <TableRow key={b._id}>
                      <TableCell className="font-medium">
                        <Link
                          href={libraryBranchDetailRoute(libraryId, b._id)}
                          className="text-primary hover:underline"
                        >
                          {b.branchName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{b.branchCode}</TableCell>
                      <TableCell>{b.totalSeats}</TableCell>
                      <TableCell>{b.city ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={b.active ? 'secondary' : 'outline'}>
                          {b.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={libraryBranchDetailRoute(libraryId, b._id)}>View</Link>
                            </DropdownMenuItem>
                            <Can permission={PERMISSIONS.BRANCH_UPDATE}>
                              <DropdownMenuItem asChild>
                                <Link href={libraryBranchEditRoute(libraryId, b._id)}>Edit</Link>
                              </DropdownMenuItem>
                            </Can>
                            <Can permission={PERMISSIONS.BRANCH_DELETE}>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => setDeleteTarget(b)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </Can>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {data && data.pagination.totalPages > 1 ? (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {data.pagination.page} of {data.pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.pagination.hasPrev}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.pagination.hasNext}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {deleteTarget ? (
        <DeleteBranchDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          libraryId={libraryId}
          branchId={deleteTarget._id}
          branchName={deleteTarget.branchName}
          loading={deleting}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </div>
  );
}
