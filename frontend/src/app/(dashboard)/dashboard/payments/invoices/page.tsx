'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { BranchSelect } from '@/components/selectors/branch-select';
import { LibrarySelect } from '@/components/selectors/library-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PERMISSIONS, ROLES } from '@/constants/permissions';
import {
  PAYMENTS_INVOICES_NEW,
  paymentCollectRoute,
  paymentInvoiceRoute,
  paymentReceiptRoute,
} from '@/constants/routes';
import { useDebounce } from '@/hooks/use-debounce';
import { usePermissions } from '@/hooks/use-permissions';
import { formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { paymentApi } from '@/modules/payments/payment.service';
import { paymentQueryKeys } from '@/modules/payments/payment-query-keys';
import { InvoiceStatusBadge } from '@/modules/payments/components/invoice-status-badge';
import { INVOICE_STATUSES, type Invoice, type InvoiceStatus } from '@/modules/payments/types';

function canCollectInvoice(inv: Invoice): boolean {
  if (inv.dueAmount <= 0.01) return false;
  return !['PAID', 'CANCELLED', 'REFUNDED', 'DRAFT'].includes(inv.status);
}

function canShowReceipt(inv: Invoice): boolean {
  return Boolean(inv.lastPaymentId) || Boolean(inv.hasActivePayments);
}

export default function InvoicesPage() {
  const { can } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const isSuper = user?.role === ROLES.SUPER_ADMIN;

  const [filterLibraryId, setFilterLibraryId] = useState('');
  const [filterBranchId, setFilterBranchId] = useState(user?.branchId ?? '');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [status, setStatus] = useState<'' | InvoiceStatus>('');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!isSuper && user?.libraryId) setFilterLibraryId(user.libraryId);
    if (user?.branchId) setFilterBranchId(user.branchId);
  }, [user, isSuper]);

  useEffect(() => {
    if (isSuper) {
      setFilterBranchId('');
    }
  }, [isSuper, filterLibraryId]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, filterBranchId, filterLibraryId, dueFrom, dueTo, isSuper]);

  const listLibraryId = isSuper ? filterLibraryId || undefined : user?.libraryId ?? undefined;
  const listBranchId = isSuper ? filterBranchId || undefined : user?.branchId ?? undefined;

  const queryEnabled =
    can(PERMISSIONS.PAYMENT_READ) && (!isSuper || Boolean(filterLibraryId && filterBranchId));

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: paymentQueryKeys.invoices({
      page,
      limit: 20,
      search: debouncedSearch.trim() || undefined,
      status: status || undefined,
      libraryId: listLibraryId,
      branchId: listBranchId,
      dueAfter: dueFrom ? `${dueFrom}T00:00:00.000Z` : undefined,
      dueBefore: dueTo ? `${dueTo}T23:59:59.999Z` : undefined,
      sortBy: 'dueDate',
      sortOrder: 'asc',
    }),
    queryFn: () =>
      paymentApi.listInvoices({
        page,
        limit: 20,
        search: debouncedSearch.trim() || undefined,
        status: status || undefined,
        libraryId: listLibraryId,
        branchId: listBranchId,
        dueAfter: dueFrom ? `${dueFrom}T00:00:00.000Z` : undefined,
        dueBefore: dueTo ? `${dueTo}T23:59:59.999Z` : undefined,
        sortBy: 'dueDate',
        sortOrder: 'asc',
      }),
    enabled: queryEnabled,
  });

  if (!can(PERMISSIONS.PAYMENT_READ)) {
    return <p className="text-sm text-muted-foreground">No payment.read permission.</p>;
  }

  if (isSuper && (!filterLibraryId || !filterBranchId)) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Invoices"
          actions={
            can(PERMISSIONS.PAYMENT_CREATE) ? (
              <Button asChild>
                <Link href={PAYMENTS_INVOICES_NEW}>New invoice</Link>
              </Button>
            ) : null
          }
        />
        <p className="text-sm text-muted-foreground">Select library workspace and branch to load invoices.</p>
        <div className="grid max-w-lg gap-4 sm:grid-cols-1">
          <LibrarySelect label="Library" value={filterLibraryId} onChange={(id) => setFilterLibraryId(id)} />
          <BranchSelect
            label="Branch"
            libraryId={filterLibraryId || null}
            value={filterBranchId}
            onChange={(id) => setFilterBranchId(id)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        actions={
          can(PERMISSIONS.PAYMENT_CREATE) ? (
            <Button asChild>
              <Link href={PAYMENTS_INVOICES_NEW}>New invoice</Link>
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
        {isSuper ? (
          <>
            <div className="min-w-[200px] flex-1 space-y-2">
              <LibrarySelect label="Library" value={filterLibraryId} onChange={(id) => setFilterLibraryId(id)} />
            </div>
            <div className="min-w-[200px] flex-1 space-y-2">
              <BranchSelect
                label="Branch"
                libraryId={filterLibraryId || null}
                value={filterBranchId}
                onChange={(id) => setFilterBranchId(id)}
              />
            </div>
          </>
        ) : null}
        <div className="min-w-[200px] flex-1 space-y-2">
          <Label htmlFor="inv-search">Search</Label>
          <Input
            id="inv-search"
            placeholder="Invoice #, student, phone, ID, seat…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="min-w-[160px] space-y-2">
          <Label htmlFor="inv-status">Status</Label>
          <select
            id="inv-status"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as '' | InvoiceStatus)}
          >
            <option value="">All statuses</option>
            {INVOICE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="grid min-w-[200px] grid-cols-2 gap-2 sm:flex sm:min-w-[280px]">
          <div className="space-y-2">
            <Label htmlFor="due-from">Due from</Label>
            <Input id="due-from" type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="due-to">Due to</Label>
            <Input id="due-to" type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} />
          </div>
        </div>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="text-destructive">{error instanceof Error ? error.message : 'Failed to load invoices.'}</p>
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invoices match your filters.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice No.</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Seat</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[200px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((inv) => {
                  const cur = inv.currency ?? 'INR';
                  return (
                    <TableRow key={inv._id}>
                      <TableCell className="font-mono text-xs">
                        <Link href={paymentInvoiceRoute(inv._id)} className="text-primary hover:underline">
                          {inv.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate">{inv.studentName ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{inv.studentCode ?? '—'}</TableCell>
                      <TableCell className="text-xs">{inv.studentPhone ?? '—'}</TableCell>
                      <TableCell>{inv.seatNumber ?? '—'}</TableCell>
                      <TableCell className="max-w-[120px] truncate text-xs">{inv.branchName ?? '—'}</TableCell>
                      <TableCell className="max-w-[100px] truncate text-xs">{inv.feePlanName ?? '—'}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{inv.dueDate?.slice(0, 10)}</TableCell>
                      <TableCell className="text-right text-xs">{formatCurrency(inv.totalAmount, cur)}</TableCell>
                      <TableCell className="text-right text-xs">{formatCurrency(inv.paidAmount, cur)}</TableCell>
                      <TableCell className="text-right text-xs font-medium">
                        {formatCurrency(inv.dueAmount, cur)}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={inv.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button variant="link" size="sm" className="h-auto px-0 py-0" asChild>
                            <Link href={paymentInvoiceRoute(inv._id)}>View</Link>
                          </Button>
                          {can(PERMISSIONS.PAYMENT_CREATE) && canCollectInvoice(inv) ? (
                            <Button variant="link" size="sm" className="h-auto px-0 py-0" asChild>
                              <Link href={paymentCollectRoute(inv._id)}>Collect</Link>
                            </Button>
                          ) : null}
                          {canShowReceipt(inv) && inv.lastPaymentId ? (
                            <Button variant="link" size="sm" className="h-auto px-0 py-0" asChild>
                              <Link href={paymentReceiptRoute(inv.lastPaymentId)} target="_blank" rel="noopener noreferrer">
                                Receipt
                                <ExternalLink className="ml-0.5 inline size-3" aria-hidden />
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total} total
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!data.pagination.hasPrev}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!data.pagination.hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
