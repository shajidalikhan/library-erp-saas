'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PERMISSIONS, ROLES } from '@/constants/permissions';
import { ROUTES, userDetailRoute } from '@/constants/routes';
import { useDebounce } from '@/hooks/use-debounce';
import { useLibraryOwnerTenantSync } from '@/hooks/use-sync-library-owner-tenant';
import { usePermissions } from '@/hooks/use-permissions';
import { useTenantScope } from '@/hooks/use-tenant-scope';
import { useAuthStore } from '@/store/auth.store';
import { ApiError } from '@/lib/api-error';
import { libraryApi } from '@/modules/library/library.service';
import { usersApi, type CreateUserPayload } from '@/modules/users/users.service';

const SUPER_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.LIBRARY_OWNER,
  ROLES.MANAGER,
  ROLES.RECEPTIONIST,
  ROLES.ACCOUNTANT,
  ROLES.SECURITY,
] as const;

const OWNER_ROLES = [
  ROLES.MANAGER,
  ROLES.RECEPTIONIST,
  ROLES.ACCOUNTANT,
  ROLES.SECURITY,
] as const;

const BRANCH_REQUIRED = new Set<string>([
  ROLES.MANAGER,
  ROLES.RECEPTIONIST,
  ROLES.ACCOUNTANT,
  ROLES.SECURITY,
]);

const needsBranch = (r: string) => BRANCH_REQUIRED.has(r);

/** Super admin must pick a library when assigning tenant scope (staff/student) or a library owner. */
const superNeedsLibrarySelection = (r: string) => needsBranch(r) || r === ROLES.LIBRARY_OWNER;

/** Non–super-admin roles use the authenticated tenant library for branch lists. */
const usesTenantLibraryForBranches = (role: string | undefined) =>
  role === ROLES.LIBRARY_OWNER ||
  role === ROLES.MANAGER ||
  role === ROLES.RECEPTIONIST ||
  role === ROLES.ACCOUNTANT ||
  role === ROLES.SECURITY;

export default function CreateUserPage() {
  const router = useRouter();
  const { needsSync: ownerTenantSyncing, isFetching: ownerTenantFetching } = useLibraryOwnerTenantSync();
  const {
    effectiveLibraryId: superWorkspaceLibraryId,
    setSuperAdminWorkspace,
    requiresLibrarySelection: superWorkspaceMissing,
  } = useTenantScope();
  const { canAny } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const isSuper = user?.role === ROLES.SUPER_ADMIN;
  const canCreate = canAny([PERMISSIONS.USER_CREATE, PERMISSIONS.STAFF_CREATE]);

  const [libSearch, setLibSearch] = useState('');
  const debouncedLibSearch = useDebounce(libSearch, 300);
  const [role, setRole] = useState<string>(isSuper ? ROLES.MANAGER : ROLES.MANAGER);
  const [branchId, setBranchId] = useState('');

  const tenantLibraryId =
    !isSuper && usesTenantLibraryForBranches(user?.role) ? (user?.libraryId ?? '') : '';

  const effectiveLibraryId = isSuper ? superWorkspaceLibraryId : tenantLibraryId;

  const { data: libs } = useQuery({
    queryKey: ['users-create-libs', debouncedLibSearch],
    queryFn: () => libraryApi.listLibraries({ limit: 50, search: debouncedLibSearch || undefined }),
    enabled: isSuper && canCreate,
  });

  const branchesQueryEnabled =
    canCreate &&
    Boolean(effectiveLibraryId) &&
    (needsBranch(role) || !isSuper);

  const {
    data: branchesData,
    isLoading: branchesLoading,
    isFetching: branchesFetching,
  } = useQuery({
    queryKey: ['users-create-branches', effectiveLibraryId],
    queryFn: () => libraryApi.listBranches(effectiveLibraryId, { limit: 100 }),
    enabled: branchesQueryEnabled,
  });

  const branchesBusy = branchesLoading || branchesFetching;
  const ownerWorkspaceBusy =
    !isSuper &&
    user?.role === ROLES.LIBRARY_OWNER &&
    !tenantLibraryId &&
    (ownerTenantSyncing || ownerTenantFetching);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const roleOptions = useMemo(() => (isSuper ? SUPER_ROLES : OWNER_ROLES), [isSuper]);

  const branches = branchesData?.items ?? [];

  if (!canCreate) {
    return (
      <div className="rounded-lg border p-6 text-sm text-muted-foreground">
        You do not have permission to create users.
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const needsLibraryInPayload =
      needsBranch(role) || (isSuper && role === ROLES.LIBRARY_OWNER);
    if (needsLibraryInPayload && !effectiveLibraryId) {
      toast.error(
        isSuper ? 'Select library workspace for this role' : 'Library context is required to create this user',
      );
      return;
    }
    if (needsBranch(role) && !branchId) {
      toast.error('Select a branch for this role');
      return;
    }
    const payload: CreateUserPayload = {
      fullName,
      email,
      phone: phone.trim() || undefined,
      password,
      isActive,
      role,
      branchId: needsBranch(role) ? branchId : undefined,
      libraryId: needsLibraryInPayload && effectiveLibraryId ? effectiveLibraryId : undefined,
    };
    setSubmitting(true);
    try {
      const created = await usersApi.create(payload);
      toast.success('User created');
      router.push(userDetailRoute(created._id));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create user"
        description={isSuper ? 'Provision any library role with tenant context.' : 'Add staff or a student login for your library.'}
        actions={
          <Button variant="outline" asChild>
            <Link href={ROUTES.USERS}>Back</Link>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            {isSuper ? (
              <div className="space-y-2">
                <Label>Library (search)</Label>
                <Input value={libSearch} onChange={(e) => setLibSearch(e.target.value)} placeholder="Search libraries…" />
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={superWorkspaceLibraryId}
                  onChange={(e) => {
                    setSuperAdminWorkspace({ libraryId: e.target.value, branchId: '' });
                    setBranchId('');
                  }}
                  required={superNeedsLibrarySelection(role)}
                >
                  <option value="">Select library…</option>
                  {libs?.items.map((l) => (
                    <option key={l._id} value={l._id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setBranchId('');
                }}
              >
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {needsBranch(role) ? (
              <div className="space-y-2">
                <Label htmlFor="branch">Branch</Label>
                {ownerWorkspaceBusy ? (
                  <p className="text-sm text-muted-foreground" aria-live="polite">
                    Loading workspace…
                  </p>
                ) : !effectiveLibraryId && !isSuper ? (
                  <p className="text-sm text-muted-foreground">
                    Library context is missing. Open Libraries or refresh after your account is linked to a library.
                  </p>
                ) : superWorkspaceMissing ? (
                  <p className="text-sm text-muted-foreground">Select library workspace first to load branches.</p>
                ) : branchesBusy ? (
                  <p className="text-sm text-muted-foreground" aria-live="polite">
                    Loading branches…
                  </p>
                ) : (
                  <select
                    id="branch"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    required
                  >
                    <option value="">Select branch…</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.branchName} ({b.branchCode})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Temporary password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Active
            </label>
            <Button type="submit" loading={submitting}>
              Create user
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
