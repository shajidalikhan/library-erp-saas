'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { BranchSelect } from '@/components/selectors/branch-select';
import { LibrarySelect } from '@/components/selectors/library-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PERMISSIONS } from '@/constants/permissions';
import { PAYMENTS_FEE_PLANS_NEW } from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { useTenantScope } from '@/hooks/use-tenant-scope';
import { paymentApi } from '@/modules/payments/payment.service';
import { paymentQueryKeys } from '@/modules/payments/payment-query-keys';
import type { FeePlanType } from '@/modules/payments/types';

export default function FeePlansPage() {
  const { can } = usePermissions();
  const { effectiveLibraryId, requiresLibrarySelection, isSuperAdmin, setSuperAdminWorkspace } =
    useTenantScope();
  const [branchId, setBranchId] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<FeePlanType | ''>('');
  const [active, setActive] = useState<string>('');

  const listEnabled = can(PERMISSIONS.FEE_PLAN_READ) && (!isSuperAdmin || Boolean(effectiveLibraryId));

  const { data, isLoading } = useQuery({
    queryKey: paymentQueryKeys.feePlans({
      search,
      libraryId: effectiveLibraryId || undefined,
      branchId: branchId || undefined,
      type: type || undefined,
      active: active === '' ? undefined : active === 'true',
    }),
    queryFn: () =>
      paymentApi.listFeePlans({
        search: search || undefined,
        libraryId: effectiveLibraryId || undefined,
        branchId: branchId || undefined,
        type: type || undefined,
        active: active === '' ? undefined : active === 'true',
        limit: 100,
      }),
    enabled: listEnabled,
  });

  if (!can(PERMISSIONS.FEE_PLAN_READ)) {
    return <p className="text-sm text-muted-foreground">No feePlan.read permission.</p>;
  }

  if (requiresLibrarySelection) {
    return (
      <EmptyState
        title="Select a library"
        description="Use the workspace bar to choose a library before viewing fee plans."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fee plans"
        actions={
          can(PERMISSIONS.FEE_PLAN_CREATE) ? (
            <Button asChild>
              <Link href={PAYMENTS_FEE_PLANS_NEW}>New fee plan</Link>
            </Button>
          ) : null
        }
      />
      <div className="flex flex-wrap gap-3">
        {isSuperAdmin ? (
          <LibrarySelect
            label="Library"
            value={effectiveLibraryId}
            onChange={(id) => {
              setSuperAdminWorkspace({ libraryId: id, branchId: '' });
              setBranchId('');
            }}
          />
        ) : null}
        <BranchSelect
          label="Branch"
          libraryId={effectiveLibraryId || null}
          value={branchId}
          onChange={setBranchId}
        />
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Type</label>
          <select
            className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as FeePlanType | '')}
          >
            <option value="">All types</option>
            <option value="REGISTRATION">Registration</option>
            <option value="MEMBERSHIP">Membership</option>
            <option value="REGISTRATION_PLUS_MEMBERSHIP">Reg + membership</option>
            <option value="CUSTOM">Custom</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <select
            className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={active}
            onChange={(e) => setActive(e.target.value)}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        <Input className="max-w-xs h-9" placeholder="Search name…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {isLoading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No fee plans match your filters.</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {isSuperAdmin ? <TableHead>Library</TableHead> : null}
                <TableHead>Branch</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((fp) => (
                <TableRow key={fp._id}>
                  {isSuperAdmin ? (
                    <TableCell className="text-sm">
                      {(fp as { libraryName?: string }).libraryName ?? '—'}
                    </TableCell>
                  ) : null}
                  <TableCell className="text-sm">
                    {(fp as { branchName?: string }).branchName ?? '—'}
                  </TableCell>
                  <TableCell>{fp.name}</TableCell>
                  <TableCell className="text-xs">{fp.type?.replace(/_/g, ' ') ?? '—'}</TableCell>
                  <TableCell>₹{fp.amount.toFixed(2)}</TableCell>
                  <TableCell>{fp.durationDays}</TableCell>
                  <TableCell>{fp.active ? 'Yes' : 'No'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
