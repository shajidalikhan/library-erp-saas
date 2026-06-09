'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { BranchSelect } from '@/components/selectors/branch-select';
import { LibrarySelect } from '@/components/selectors/library-select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PERMISSIONS } from '@/constants/permissions';
import { paymentInvoiceRoute } from '@/constants/routes';
import { useDebounce } from '@/hooks/use-debounce';
import { usePermissions } from '@/hooks/use-permissions';
import { useTenantScope } from '@/hooks/use-tenant-scope';
import { paymentApi } from '@/modules/payments/payment.service';
import { paymentQueryKeys } from '@/modules/payments/payment-query-keys';
import { InvoiceStatusBadge } from '@/modules/payments/components/invoice-status-badge';

export default function DuesPage() {
  const { can } = usePermissions();
  const { effectiveLibraryId, requiresLibrarySelection, isSuperAdmin, setSuperAdminWorkspace } =
    useTenantScope();
  const [branchId, setBranchId] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [filter, setFilter] = useState<
    'all' | 'overdue' | 'dueToday' | 'downgradePending' | 'downgraded'
  >('all');

  const today = new Date().toISOString().slice(0, 10);

  const params = {
    libraryId: effectiveLibraryId || undefined,
    branchId: branchId || undefined,
    search: debouncedSearch || undefined,
    hasOpenBalance: true as const,
    overdueOnly: filter === 'overdue' ? true : undefined,
    downgradePending: filter === 'downgradePending' ? true : undefined,
    downgraded: filter === 'downgraded' ? true : undefined,
    dueAfter: filter === 'dueToday' ? `${today}T00:00:00.000Z` : undefined,
    dueBefore: filter === 'dueToday' ? `${today}T23:59:59.999Z` : undefined,
    limit: 100,
    page: 1,
  };

  const { data, isLoading } = useQuery({
    queryKey: paymentQueryKeys.dues(params),
    queryFn: () => paymentApi.listDues(params),
    enabled: can(PERMISSIONS.PAYMENT_READ) && (!isSuperAdmin || Boolean(effectiveLibraryId)),
  });

  if (!can(PERMISSIONS.PAYMENT_READ)) {
    return <p className="text-sm text-muted-foreground">No payment.read.</p>;
  }

  if (requiresLibrarySelection) {
    return (
      <EmptyState
        title="Select a library"
        description="Use the workspace bar to choose a library before viewing dues."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dues" description="Open balances across students and branches." />
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
        <div className="flex gap-1 items-end">
          {(
            ['all', 'overdue', 'dueToday', 'downgradePending', 'downgraded'] as const
          ).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs ${
                filter === f ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'
              }`}
            >
              {f === 'all'
                ? 'All open'
                : f === 'overdue'
                  ? 'Overdue'
                  : f === 'dueToday'
                    ? 'Due today'
                    : f === 'downgradePending'
                      ? 'Downgrade pending'
                      : 'Downgraded'}
            </button>
          ))}
        </div>
        <Input
          className="max-w-sm h-9"
          placeholder="Invoice #, student, seat, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {isLoading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : !data.items.length ? (
        <p className="text-sm text-muted-foreground">No open dues.</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {isSuperAdmin ? <TableHead>Library</TableHead> : null}
                <TableHead>Branch</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Seat</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Downgrade due</TableHead>
                <TableHead>Due amount</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((inv) => (
                <TableRow key={inv._id}>
                  {isSuperAdmin ? <TableCell>{inv.libraryName ?? '—'}</TableCell> : null}
                  <TableCell>{inv.branchName ?? '—'}</TableCell>
                  <TableCell>{inv.studentName ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{inv.studentCode ?? '—'}</TableCell>
                  <TableCell>{inv.seatNumber ?? '—'}</TableCell>
                  <TableCell>
                    <Link href={paymentInvoiceRoute(inv._id)} className="font-mono text-xs text-primary hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{inv.dueDate?.slice(0, 10)}</TableCell>
                  <TableCell>{inv.downgradeDueDate?.slice(0, 10) ?? '—'}</TableCell>
                  <TableCell>₹{inv.dueAmount.toFixed(2)}</TableCell>
                  <TableCell className="text-xs">
                    {inv.downgradeIfUnpaid && inv.dueAmount > 0
                      ? 'Downgrade risk'
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <InvoiceStatusBadge status={inv.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
