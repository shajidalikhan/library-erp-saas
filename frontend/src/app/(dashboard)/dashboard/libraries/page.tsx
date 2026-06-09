'use client';

import Link from 'next/link';
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
import { DeleteLibraryDialog } from '@/modules/library/components/delete-library-dialog';
import { PERMISSIONS } from '@/constants/permissions';
import { ROUTES, libraryDetailRoute } from '@/constants/routes';
import { useDebounce } from '@/hooks/use-debounce';
import { usePermissions } from '@/hooks/use-permissions';
import { ApiError } from '@/lib/api-error';
import { libraryApi, type LibraryListParams } from '@/modules/library/library.service';
import { libraryQueryKeys } from '@/modules/library/library-query-keys';
import type { Library } from '@/modules/library/types';
import { SubscriptionPlanBadge } from '@/modules/subscription/components/subscription-plan-badge';

export default function LibrariesListPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [status, setStatus] = useState<string>('');
  const [expiryState, setExpiryState] = useState('');
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [sortBy, setSortBy] = useState<LibraryListParams['sortBy']>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const listParams = useMemo(
    () =>
      ({
        page,
        limit: 10,
        search: debouncedSearch.trim() || undefined,
        sortBy,
        sortOrder,
        status: (status || undefined) as LibraryListParams['status'],
        ...(expiryState ? { expiryState } : {}),
        ...(expiringSoon ? { expiringWithinDays: 3 } : {}),
      }) satisfies LibraryListParams,
    [page, debouncedSearch, sortBy, sortOrder, status, expiryState, expiringSoon],
  );

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: libraryQueryKeys.libraries(listParams),
    queryFn: () => libraryApi.listLibraries(listParams),
    enabled: can(PERMISSIONS.LIBRARY_READ),
  });

  const [deleteTarget, setDeleteTarget] = useState<Library | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (confirmPhrase: string) => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await libraryApi.deleteLibrary(deleteTarget._id, confirmPhrase);
      toast.success('Library deleted');
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['libraries'] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  if (!can(PERMISSIONS.LIBRARY_READ)) {
    return (
      <EmptyState
        title="No access"
        description="You do not have permission to view libraries."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Libraries"
        description="Provision and monitor every tenant on the platform."
        actions={
          <Can permission={PERMISSIONS.LIBRARY_CREATE}>
            <Button asChild>
              <Link href={`${ROUTES.LIBRARIES}/new`}>
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                New library
              </Link>
            </Button>
          </Can>
        }
      />

      <Card className="border-border/60 shadow-soft">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-1 flex-col gap-2 sm:max-w-md">
              <label className="text-sm font-medium text-muted-foreground" htmlFor="lib-search">
                Search
              </label>
              <Input
                id="lib-search"
                placeholder="Name, slug, email, city…"
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-muted-foreground">Status</span>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={status}
                  onChange={(e) => {
                    setPage(1);
                    setStatus(e.target.value);
                  }}
                >
                  <option value="">All</option>
                  <option value="ACTIVE">Active</option>
                  <option value="TRIAL">Trial</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-muted-foreground">Lifecycle</span>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={expiryState}
                  onChange={(e) => {
                    setPage(1);
                    setExpiryState(e.target.value);
                  }}
                >
                  <option value="">All</option>
                  <option value="TRIAL">Trial</option>
                  <option value="ACTIVE">Active</option>
                  <option value="EXPIRING_SOON">Expiring soon</option>
                  <option value="GRACE_PERIOD">Grace period</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={expiringSoon}
                  onChange={(e) => {
                    setPage(1);
                    setExpiringSoon(e.target.checked);
                  }}
                />
                Expiring ≤3 days
              </label>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-muted-foreground">Sort</span>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={`${sortBy}:${sortOrder}`}
                  onChange={(e) => {
                    const [sb, so] = e.target.value.split(':') as [LibraryListParams['sortBy'], 'asc' | 'desc'];
                    setSortBy(sb);
                    setSortOrder(so);
                  }}
                >
                  <option value="createdAt:desc">Newest</option>
                  <option value="createdAt:asc">Oldest</option>
                  <option value="name:asc">Name A–Z</option>
                  <option value="name:desc">Name Z–A</option>
                  <option value="status:asc">Status</option>
                </select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => void refetch()}
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden />
              </Button>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {error instanceof Error ? error.message : 'Failed to load libraries'}
            </div>
          ) : null}

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data?.items.length ? (
            <EmptyState
              title="No libraries yet"
              description="Create a library to onboard a new tenant."
              action={
                <Can permission={PERMISSIONS.LIBRARY_CREATE}>
                  <Button asChild>
                    <Link href={`${ROUTES.LIBRARIES}/new`}>Create library</Link>
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
                    <TableHead>Slug</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead className="w-[72px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((lib) => (
                    <TableRow key={lib._id}>
                      <TableCell className="font-medium">
                        <Link
                          href={libraryDetailRoute(lib._id)}
                          className="text-primary hover:underline"
                        >
                          {lib.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{lib.slug}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{lib.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <SubscriptionPlanBadge
                          libraryId={lib._id}
                          planCode={lib.plan?.code ?? lib.subscription?.planCode ?? lib.subscriptionPlan}
                          prefetchedSnapshot={lib.plan ? { plan: lib.plan } : undefined}
                          prefetchedSubscription={lib.subscription}
                        />
                      </TableCell>
                      <TableCell>{lib.city ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" aria-hidden />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={libraryDetailRoute(lib._id)}>View</Link>
                            </DropdownMenuItem>
                            <Can permission={PERMISSIONS.LIBRARY_UPDATE}>
                              <DropdownMenuItem asChild>
                                <Link href={`${ROUTES.LIBRARIES}/${lib._id}/edit`}>Edit</Link>
                              </DropdownMenuItem>
                            </Can>
                            <Can permission={PERMISSIONS.LIBRARY_DELETE}>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => setDeleteTarget(lib)}
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
                Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total}{' '}
                total)
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
        <DeleteLibraryDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          libraryName={deleteTarget.name}
          loading={deleting}
          onConfirm={(confirmPhrase) => void handleDelete(confirmPhrase)}
        />
      ) : null}
    </div>
  );
}
