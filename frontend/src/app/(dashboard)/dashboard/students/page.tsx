'use client';

import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, MoreHorizontal, Plus, RefreshCw } from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PERMISSIONS } from '@/constants/permissions';
import {
  ROUTES,
  paymentCollectStudentRoute,
  studentDetailRoute,
  studentEditRoute,
  studentNewRoute,
  studentSummaryRoute,
} from '@/constants/routes';
import { useDebounce } from '@/hooks/use-debounce';
import { usePermissions } from '@/hooks/use-permissions';
import { useTenantScope } from '@/hooks/use-tenant-scope';
import { useLibraryOwnerTenantSync } from '@/hooks/use-sync-library-owner-tenant';
import { useAuthStore } from '@/store/auth.store';
import { useSubscriptionUsage } from '@/modules/subscription/hooks/use-subscription-usage';
import { PlanLimitButton } from '@/modules/subscription/components/plan-limit-button';
import { ApiError } from '@/lib/api-error';
import { libraryApi } from '@/modules/library/library.service';
import { studentApi, type StudentListParams } from '@/modules/students/student.service';
import { studentQueryKeys } from '@/modules/students/student-query-keys';
import {
  useStudentTableColumns,
  type StudentColumnId,
} from '@/modules/students/hooks/use-student-table-columns';
import type { Student } from '@/modules/students/types';
import { MembershipDashboardCards } from '@/modules/students/components/membership-dashboard-cards';

function legacyMembershipFromUrl(filter: string | null): {
  membershipStatus?: 'ACTIVE' | 'SUSPENDED';
  expiringIn?: '1-3' | '4-7';
} {
  if (!filter) return {};
  if (filter === 'active') return { membershipStatus: 'ACTIVE' };
  if (filter === 'expired') return { membershipStatus: 'SUSPENDED' };
  if (filter === 'expiring1to3') return { expiringIn: '1-3' };
  if (filter === 'expiring4to7') return { expiringIn: '4-7' };
  return {};
}

function membershipFilterLabel(
  membershipStatus: string,
  expiringIn: string,
): string | null {
  if (membershipStatus === 'ACTIVE') return 'Active members';
  if (membershipStatus === 'SUSPENDED' || membershipStatus === 'EXPIRED') return 'Expired / suspended';
  if (expiringIn === '1-3') return 'Expiring in 1–3 days';
  if (expiringIn === '4-7') return 'Expiring in 4–7 days';
  return null;
}

const COLUMN_LABELS: Record<StudentColumnId, string> = {
  studentId: 'Student ID',
  fullName: 'Name',
  branch: 'Branch',
  status: 'Status',
  membershipEnd: 'Membership end',
  email: 'Email',
  phone: 'Phone',
  actions: 'Actions',
};

export default function StudentsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const legacy = legacyMembershipFromUrl(searchParams.get('membershipFilter'));
  const urlMembershipStatus =
    searchParams.get('membershipStatus') ?? legacy.membershipStatus ?? '';
  const urlExpiringIn = searchParams.get('expiringIn') ?? legacy.expiringIn ?? '';
  const { can, canAny } = usePermissions();
  const { needsSync, isFetching: tenantSyncing } = useLibraryOwnerTenantSync();
  const {
    effectiveLibraryId,
    requiresLibrarySelection,
    isSuperAdmin,
    isTenantUser,
  } = useTenantScope();
  const queryClient = useQueryClient();
  const { canCreate } = useSubscriptionUsage(effectiveLibraryId ?? undefined);
  const user = useAuthStore((s) => s.user);
  const { visible, toggle } = useStudentTableColumns();

  const canView = canAny([PERMISSIONS.STUDENT_READ, PERMISSIONS.STUDENT_READ_BASIC]);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [status, setStatus] = useState<string>('');
  const [branchId, setBranchId] = useState<string>('');
  const [membershipExpired, setMembershipExpired] = useState<string>('');
  const [membershipStatus, setMembershipStatus] = useState(urlMembershipStatus);
  const [expiringIn, setExpiringIn] = useState(urlExpiringIn);
  const [sortBy, setSortBy] = useState<string>('createdAt');

  useEffect(() => {
    setMembershipStatus(urlMembershipStatus);
    setExpiringIn(urlExpiringIn);
    setPage(1);
  }, [urlMembershipStatus, urlExpiringIn]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const listReady =
    canView &&
    !requiresLibrarySelection &&
    (isSuperAdmin || !needsSync || Boolean(user?.libraryId));

  const listParams = useMemo(() => {
    const p: StudentListParams = {
      page,
      limit: 12,
      search: debouncedSearch.trim() || undefined,
      sortBy,
      sortOrder,
      status: (status || undefined) as Student['status'] | undefined,
      branchId: branchId || undefined,
      membershipExpired:
        membershipExpired === 'true' ? true : membershipExpired === 'false' ? false : undefined,
      membershipStatus: (membershipStatus || undefined) as StudentListParams['membershipStatus'],
      expiringIn: (expiringIn || undefined) as StudentListParams['expiringIn'],
    };
    if (isSuperAdmin && effectiveLibraryId) {
      p.libraryId = effectiveLibraryId;
    }
    return p;
  }, [
    page,
    debouncedSearch,
    sortBy,
    sortOrder,
    status,
    branchId,
    membershipExpired,
    membershipStatus,
    expiringIn,
    isSuperAdmin,
    effectiveLibraryId,
  ]);

  const { data: branchesData } = useQuery({
    queryKey: ['branches-filter', effectiveLibraryId],
    queryFn: () => libraryApi.listBranches(effectiveLibraryId!, { limit: 100 }),
    enabled: Boolean(effectiveLibraryId) && can(PERMISSIONS.BRANCH_READ),
  });

  const branchLabel = useMemo(() => {
    const m = new Map<string, string>();
    branchesData?.items.forEach((b) => m.set(b._id, b.branchName));
    return m;
  }, [branchesData]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: studentQueryKeys.list(listParams),
    queryFn: () => studentApi.list(listParams),
    enabled: listReady,
  });

  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  const activeMembershipLabel = membershipFilterLabel(membershipStatus, expiringIn);

  const clearMembershipFilters = () => {
    setMembershipStatus('');
    setExpiringIn('');
    setMembershipExpired('');
    setPage(1);
    router.replace(ROUTES.STUDENTS);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await studentApi.remove(deleteTarget._id);
      toast.success('Student removed');
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['students'] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  if (!canView) {
    return <EmptyState title="No access" description="You do not have permission to view students." />;
  }

  if (requiresLibrarySelection) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Students"
          description="Search, filter, and manage admissions across branches."
        />
        <EmptyState
          title="Select a library to manage students"
          description="Use the workspace bar above to choose a library (and optional branch), then search and admit students for that tenant."
          action={
            <Button asChild>
              <Link href={ROUTES.LIBRARIES}>Open libraries</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (isTenantUser && needsSync && tenantSyncing && !user?.libraryId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Students"
          description="Search, filter, and manage admissions across branches."
        />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (isTenantUser && !needsSync && !user?.libraryId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Students"
          description="Search, filter, and manage admissions across branches."
        />
        <EmptyState
          title="Library not linked"
          description="Your owner account is not linked to a library yet. Open Libraries to finish setup or contact support."
          action={
            <Button asChild>
              <Link href={ROUTES.LIBRARIES}>Open libraries</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <MembershipDashboardCards branchId={branchId || user?.branchId || undefined} />

      <PageHeader
        title="Students"
        description="Search, filter, and manage admissions across branches."
        actions={
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  Columns
                  <ChevronDown className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {(Object.keys(COLUMN_LABELS) as StudentColumnId[])
                  .filter((c) => c !== 'actions')
                  .map((id) => (
                    <DropdownMenuCheckboxItem
                      key={id}
                      checked={visible[id]}
                      onCheckedChange={() => toggle(id)}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {COLUMN_LABELS[id]}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Can permission={PERMISSIONS.STUDENT_CREATE}>
              <PlanLimitButton entity="students" blocked={!canCreate('students')} asChild>
                <Link href={studentNewRoute()}>
                  <Plus className="mr-2 h-4 w-4" aria-hidden />
                  Add student
                </Link>
              </PlanLimitButton>
            </Can>
          </div>
        }
      />

      <Card className="border-border/60 shadow-soft">
        <CardContent className="space-y-4 pt-6">
          {activeMembershipLabel ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1 px-3 py-1">
                {activeMembershipLabel}
              </Badge>
              <Button type="button" variant="ghost" size="sm" onClick={clearMembershipFilters}>
                Clear filter
              </Button>
            </div>
          ) : null}
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-md">
              <label className="text-sm font-medium text-muted-foreground" htmlFor="stu-search">
                Search
              </label>
              <Input
                id="stu-search"
                placeholder="Name, student id, email, phone…"
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              {branchesData?.items.length ? (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Branch</span>
                  <select
                    className="h-10 min-w-[140px] rounded-md border border-input bg-background px-3 text-sm"
                    value={branchId}
                    onChange={(e) => {
                      setPage(1);
                      setBranchId(e.target.value);
                    }}
                  >
                    <option value="">All branches</option>
                    {branchesData.items.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.branchName}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
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
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-muted-foreground">Membership</span>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={membershipExpired}
                  onChange={(e) => {
                    setPage(1);
                    setMembershipExpired(e.target.value);
                  }}
                >
                  <option value="">Any</option>
                  <option value="false">Valid / open</option>
                  <option value="true">Expired</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-muted-foreground">Sort</span>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={`${sortBy}:${sortOrder}`}
                  onChange={(e) => {
                    const [sb, so] = e.target.value.split(':') as [string, 'asc' | 'desc'];
                    setSortBy(sb);
                    setSortOrder(so);
                  }}
                >
                  <option value="createdAt:desc">Recently added</option>
                  <option value="fullName:asc">Name A–Z</option>
                  <option value="membershipEndDate:asc">Membership ending soon</option>
                  <option value="status:asc">Status</option>
                </select>
              </div>
              <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => void refetch()}>
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden />
              </Button>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {error instanceof Error ? error.message : 'Failed to load students'}
            </div>
          ) : null}

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data?.items.length ? (
            <EmptyState
              title="No students found"
              description="Adjust filters or admit your first student."
              action={
                <Can permission={PERMISSIONS.STUDENT_CREATE}>
                  <Button asChild>
                    <Link href={studentNewRoute()}>Add student</Link>
                  </Button>
                </Can>
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visible.studentId ? <TableHead>Student ID</TableHead> : null}
                    {visible.fullName ? <TableHead>Name</TableHead> : null}
                    {visible.branch ? <TableHead>Branch</TableHead> : null}
                    {visible.status ? <TableHead>Status</TableHead> : null}
                    {visible.membershipEnd ? <TableHead>Membership end</TableHead> : null}
                    {visible.email ? <TableHead>Email</TableHead> : null}
                    {visible.phone ? <TableHead>Phone</TableHead> : null}
                    {visible.actions ? <TableHead className="w-[72px] text-right">Actions</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((s) => (
                    <TableRow key={s._id}>
                      {visible.studentId ? (
                        <TableCell className="font-mono text-xs text-muted-foreground">{s.studentId}</TableCell>
                      ) : null}
                      {visible.fullName ? (
                        <TableCell className="font-medium">
                          <Link href={studentDetailRoute(s._id)} className="text-primary hover:underline">
                            {s.fullName}
                          </Link>
                        </TableCell>
                      ) : null}
                      {visible.branch ? (
                        <TableCell className="text-muted-foreground">{branchLabel.get(s.branchId) ?? '—'}</TableCell>
                      ) : null}
                      {visible.status ? (
                        <TableCell>
                          <Badge variant="secondary">{s.status}</Badge>
                        </TableCell>
                      ) : null}
                      {visible.membershipEnd ? (
                        <TableCell className="text-sm text-muted-foreground">
                          {s.membershipEndDate ? s.membershipEndDate.slice(0, 10) : '—'}
                        </TableCell>
                      ) : null}
                      {visible.email ? <TableCell className="text-sm">{s.email ?? '—'}</TableCell> : null}
                      {visible.phone ? <TableCell className="text-sm">{s.phone ?? '—'}</TableCell> : null}
                      {visible.actions ? (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={studentDetailRoute(s._id)}>View</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={studentSummaryRoute(s._id)}>Summary</Link>
                              </DropdownMenuItem>
                              <Can permission={PERMISSIONS.PAYMENT_CREATE}>
                                <DropdownMenuItem asChild>
                                  <Link href={paymentCollectStudentRoute(s._id)}>Collect payment</Link>
                                </DropdownMenuItem>
                              </Can>
                              <Can permission={PERMISSIONS.STUDENT_UPDATE}>
                                <DropdownMenuItem asChild>
                                  <Link href={studentEditRoute(s._id)}>Edit</Link>
                                </DropdownMenuItem>
                              </Can>
                              <Can permission={PERMISSIONS.STUDENT_DELETE}>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onSelect={() => setDeleteTarget(s)}
                                >
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

          {data && data.pagination.totalPages > 1 ? (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total)
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={!data.pagination.hasPrev} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={!data.pagination.hasNext} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete student?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void handleDelete()}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
