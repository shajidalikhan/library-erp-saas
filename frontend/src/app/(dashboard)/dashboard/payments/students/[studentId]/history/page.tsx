'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PERMISSIONS } from '@/constants/permissions';
import { paymentInvoiceRoute, paymentReceiptRoute } from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { paymentApi } from '@/modules/payments/payment.service';
import { paymentQueryKeys } from '@/modules/payments/payment-query-keys';
import { InvoiceStatusBadge } from '@/modules/payments/components/invoice-status-badge';
import { PaymentMethodBadge } from '@/modules/payments/components/payment-method-badge';

export default function StudentPaymentHistoryPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = params.studentId;
  const { can } = usePermissions();
  const { data, isLoading } = useQuery({
    queryKey: paymentQueryKeys.history(studentId),
    queryFn: () => paymentApi.studentHistory(studentId),
    enabled: Boolean(studentId) && can(PERMISSIONS.PAYMENT_READ),
  });

  if (!can(PERMISSIONS.PAYMENT_READ)) {
    return <p className="text-sm text-muted-foreground">No payment.read permission.</p>;
  }
  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (!data) return <p className="text-sm text-muted-foreground">Unable to load history.</p>;

  return (
    <div className="space-y-8">
      <PageHeader
        title={String(data.student.fullName ?? 'Student')}
        description={`${String(data.student.studentId ?? '')}`}
      />
      <div className="space-y-3">
        <h2 className="text-sm font-medium">Invoices</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.invoices.map((inv) => (
                <TableRow key={inv._id}>
                  <TableCell>
                    <Link href={paymentInvoiceRoute(inv._id)} className="font-mono text-xs text-primary hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <InvoiceStatusBadge status={inv.status} />
                  </TableCell>
                  <TableCell>{inv.dueDate?.slice(0, 10)}</TableCell>
                  <TableCell>₹{inv.dueAmount.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="space-y-3">
        <h2 className="text-sm font-medium">Payments</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.payments.map((p) => (
                <TableRow key={p._id}>
                  <TableCell>
                    <Link href={paymentReceiptRoute(p._id)} className="font-mono text-xs text-primary hover:underline">
                      {p.receiptNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{new Date(p.paidAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <PaymentMethodBadge method={p.method} />
                  </TableCell>
                  <TableCell>₹{p.amount.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
