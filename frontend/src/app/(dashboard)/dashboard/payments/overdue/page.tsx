'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PERMISSIONS } from '@/constants/permissions';
import { paymentInvoiceRoute } from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/store/auth.store';
import { paymentApi } from '@/modules/payments/payment.service';
import { paymentQueryKeys } from '@/modules/payments/payment-query-keys';
import { InvoiceStatusBadge } from '@/modules/payments/components/invoice-status-badge';

export default function OverduePage() {
  const { can } = usePermissions();
  const libraryId = useAuthStore((s) => s.user?.libraryId ?? undefined);
  const branchId = useAuthStore((s) => s.user?.branchId ?? undefined);
  const { data, isLoading } = useQuery({
    queryKey: paymentQueryKeys.overdue({ libraryId, branchId }),
    queryFn: () => paymentApi.listOverdue({ libraryId, branchId, limit: 100 }),
    enabled: can(PERMISSIONS.PAYMENT_READ),
  });

  if (!can(PERMISSIONS.PAYMENT_READ)) return <p className="text-sm text-muted-foreground">No payment.read.</p>;
  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;
  if (!data.items.length) return <p className="text-sm text-muted-foreground">No overdue invoices.</p>;

  return (
    <div className="space-y-6">
      <PageHeader title="Overdue invoices" />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Was due</TableHead>
              <TableHead>Due amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((inv) => (
              <TableRow key={inv._id}>
                <TableCell>
                  <Link href={paymentInvoiceRoute(inv._id)} className="text-primary hover:underline font-mono text-xs">
                    {inv.invoiceNumber}
                  </Link>
                </TableCell>
                <TableCell>{inv.dueDate?.slice(0, 10)}</TableCell>
                <TableCell>₹{inv.dueAmount.toFixed(2)}</TableCell>
                <TableCell>
                  <InvoiceStatusBadge status={inv.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
