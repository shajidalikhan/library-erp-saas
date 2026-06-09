'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { BranchSelect } from '@/components/selectors/branch-select';
import { LibrarySelect } from '@/components/selectors/library-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PERMISSIONS, ROLES } from '@/constants/permissions';
import { userDetailRoute, userEditRoute, userNewRoute } from '@/constants/routes';
import { useDebounce } from '@/hooks/use-debounce';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/store/auth.store';
import { Can } from '@/components/auth/can';
import { ApiError } from '@/lib/api-error';
import { usersApi, type ManagedUser } from '@/modules/users/users.service';
import { DeleteUserDialog } from '@/modules/users/components/delete-user-dialog';
import { useSubscriptionUsage } from '@/modules/subscription/hooks/use-subscription-usage';
import { PlanLimitButton } from '@/modules/subscription/components/plan-limit-button';

const OWNER_ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: ROLES.MANAGER, label: 'Manager' },
  { value: ROLES.RECEPTIONIST, label: 'Receptionist' },
  { value: ROLES.ACCOUNTANT, label: 'Accountant' },
  { value: ROLES.SECURITY, label: 'Security' },
];

const SUPER_ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: ROLES.SUPER_ADMIN, label: 'Super Admin' },
  { value: ROLES.LIBRARY_OWNER, label: 'Library owner' },
  ...OWNER_ROLE_OPTIONS.filter((o) => o.value),
];

function statusBadge(user: ManagedUser) {
  const status = user.status ?? (user.isActive ? 'ACTIVE' : 'INACTIVE');
  if (status === 'DELETED') return <Badge variant="destructive">Deleted</Badge>;
  if (status === 'SUSPENDED') return <Badge variant="destructive">Suspended</Badge>;
  if (status === 'INACTIVE' || !user.isActive) return <Badge variant="secondary">Inactive</Badge>;
  return <Badge variant="default">Active</Badge>;
}

export default function UsersListPage() {
  const qc = useQueryClient();
  const { canCreate } = useSubscriptionUsage();
  const { can, canAny } = usePermissions();
  const authUser = useAuthStore((s) => s.user);
  const isSuperAdmin = authUser?.role === ROLES.SUPER_ADMIN;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const [libraryFilter, setLibraryFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);

  const canView = canAny([PERMISSIONS.USER_READ, PERMISSIONS.STAFF_READ]);
  const canManageLifecycle = isSuperAdmin && can(PERMISSIONS.USER_DELETE);

  const { data, isLoading } = useQuery({
    queryKey: [
      'users',
      page,
      debounced,
      libraryFilter,
      branchFilter,
      roleFilter,
      statusFilter,
      createdFrom,
      createdTo,
      isSuperAdmin,
    ],
    queryFn: () =>
      usersApi.list({
        page,
        limit: 15,
        search: debounced || undefined,
        libraryId: isSuperAdmin
          ? libraryFilter || undefined
          : authUser?.libraryId ?? undefined,
        branchId: branchFilter || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        includeInactive: true,
        createdFrom: createdFrom ? new Date(createdFrom).toISOString() : undefined,
        createdTo: createdTo ? new Date(createdTo).toISOString() : undefined,
      }),
    enabled: canView,
  });

  const lifecycleM = useMutation({
    mutationFn: async (action: { type: 'activate' | 'deactivate' | 'delete'; id: string }) => {
      if (action.type === 'activate') return usersApi.activate(action.id);
      if (action.type === 'deactivate') return usersApi.deactivate(action.id);
      return usersApi.remove(action.id);
    },
    onSuccess: (_r, vars) => {
      toast.success(
        vars.type === 'activate'
          ? 'User activated'
          : vars.type === 'deactivate'
            ? 'User deactivated'
            : 'User deleted',
      );
      setDeleteTarget(null);
      void qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Action failed'),
  });

  const rows = useMemo(() => data?.items ?? [], [data]);
  const roleOptions = isSuperAdmin ? SUPER_ROLE_OPTIONS : OWNER_ROLE_OPTIONS;

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have access to the user directory.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={
          isSuperAdmin
            ? 'Manage all platform users, owners, staff, and super admins.'
            : 'Provision staff logins with tenant-safe defaults.'
        }
        actions={
          <Can permission={[PERMISSIONS.USER_CREATE, PERMISSIONS.STAFF_CREATE]}>
            <PlanLimitButton entity="staff" blocked={!canCreate('staff')} asChild>
              <Link href={userNewRoute()}>Create user</Link>
            </PlanLimitButton>
          </Can>
        }
      />
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="u-search">Search</Label>
              <Input
                id="u-search"
                placeholder="Name, email, phone…"
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
              />
            </div>
            {isSuperAdmin ? (
              <div className="space-y-1.5">
                <LibrarySelect
                  label="Library"
                  value={libraryFilter}
                  onChange={(id) => {
                    setPage(1);
                    setLibraryFilter(id);
                    setBranchFilter('');
                  }}
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <BranchSelect
                label="Branch"
                libraryId={isSuperAdmin ? libraryFilter || null : authUser?.libraryId ?? null}
                value={branchFilter}
                onChange={(id) => {
                  setPage(1);
                  setBranchFilter(id);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-role">Role</Label>
              <select
                id="u-role"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={roleFilter}
                onChange={(e) => {
                  setPage(1);
                  setRoleFilter(e.target.value);
                }}
              >
                {roleOptions.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-status">Status</Label>
              <select
                id="u-status"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(e) => {
                  setPage(1);
                  setStatusFilter(e.target.value);
                }}
              >
                <option value="">All</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="DELETED">Deleted</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-from">Created from</Label>
              <Input
                id="u-from"
                type="date"
                value={createdFrom}
                onChange={(e) => {
                  setPage(1);
                  setCreatedFrom(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-to">Created to</Label>
              <Input
                id="u-to"
                type="date"
                value={createdTo}
                onChange={(e) => {
                  setPage(1);
                  setCreatedTo(e.target.value);
                }}
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((u) => {
                    const status = u.status ?? (u.isActive ? 'ACTIVE' : 'INACTIVE');
                    const isRoot = Boolean(u.isRootSuperAdmin);
                    const isSelf = u._id === authUser?.id;
                    return (
                      <TableRow key={u._id}>
                        <TableCell className="font-medium">
                          {u.fullName}
                          {isRoot ? (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              Root
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>{String(u.role)}</TableCell>
                        <TableCell>{statusBadge(u)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={userDetailRoute(u._id)}>View</Link>
                            </Button>
                            <Can permission={[PERMISSIONS.USER_UPDATE, PERMISSIONS.STAFF_UPDATE]}>
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={userEditRoute(u._id)}>Edit</Link>
                              </Button>
                            </Can>
                            {canManageLifecycle && !isRoot && !isSelf ? (
                              <>
                                {status !== 'ACTIVE' && status !== 'DELETED' ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={lifecycleM.isPending}
                                    onClick={() =>
                                      lifecycleM.mutate({ type: 'activate', id: u._id })
                                    }
                                  >
                                    Activate
                                  </Button>
                                ) : null}
                                {status === 'ACTIVE' ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={lifecycleM.isPending}
                                    onClick={() =>
                                      lifecycleM.mutate({ type: 'deactivate', id: u._id })
                                    }
                                  >
                                    Deactivate
                                  </Button>
                                ) : null}
                                {status !== 'DELETED' ? (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={lifecycleM.isPending}
                                    onClick={() => setDeleteTarget(u)}
                                  >
                                    Delete
                                  </Button>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>
              Page {page}
              {data?.pagination && typeof data.pagination === 'object' && 'total' in data.pagination
                ? ` · ${String((data.pagination as { total: number }).total)} total`
                : null}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!data?.pagination || !(data.pagination as { hasNext?: boolean }).hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <DeleteUserDialog
        user={deleteTarget}
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        isPending={lifecycleM.isPending}
        onConfirm={() => {
          if (deleteTarget) lifecycleM.mutate({ type: 'delete', id: deleteTarget._id });
        }}
      />
    </div>
  );
}
