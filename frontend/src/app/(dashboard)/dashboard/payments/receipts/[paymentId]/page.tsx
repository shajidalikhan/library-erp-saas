'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { formatEntityLabel } from '@/lib/entity-label';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS } from '@/constants/permissions';
import { paymentInvoiceRoute } from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { paymentApi } from '@/modules/payments/payment.service';
import { paymentQueryKeys } from '@/modules/payments/payment-query-keys';
import { InvoiceStatusBadge } from '@/modules/payments/components/invoice-status-badge';
import { PaymentMethodBadge } from '@/modules/payments/components/payment-method-badge';

export default function ReceiptPage() {
  const params = useParams<{ paymentId: string }>();
  const paymentId = params.paymentId;
  const { can } = usePermissions();
  const { data, isLoading } = useQuery({
    queryKey: paymentQueryKeys.receipt(paymentId),
    queryFn: () => paymentApi.getReceipt(paymentId),
    enabled: Boolean(paymentId) && can(PERMISSIONS.PAYMENT_READ),
  });

  if (!can(PERMISSIONS.PAYMENT_READ)) {
    return <p className="text-sm text-muted-foreground">No payment.read permission.</p>;
  }
  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (!data?.payment) return <p className="text-sm text-muted-foreground">Receipt not found.</p>;

  const p = data.payment;
  const s = data.student;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Receipt ${p.receiptNumber}`}
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              Print
            </Button>
            {data.invoice ? (
              <Button variant="ghost" asChild>
                <Link href={paymentInvoiceRoute(data.invoice._id)}>Invoice</Link>
              </Button>
            ) : null}
          </>
        }
      />
      <Card className="print:shadow-none">
        <CardContent className="space-y-4 p-8 text-sm">
          <div className="flex justify-between border-b pb-4">
            <div>
              <p className="font-semibold">Payment receipt</p>
              <p className="text-muted-foreground">{new Date(p.paidAt).toLocaleString()}</p>
            </div>
            <PaymentMethodBadge method={p.method} />
          </div>
          <p>
            <span className="text-muted-foreground">Student:</span>{' '}
            {formatEntityLabel(
              {
                studentName: s?.fullName,
                studentCode: s?.studentId,
              },
              'student',
            )}
          </p>
          <p>
            <span className="text-muted-foreground">Amount:</span> ₹{p.amount.toFixed(2)}
          </p>
          {p.transactionId ? (
            <p>
              <span className="text-muted-foreground">Txn:</span> {p.transactionId}
            </p>
          ) : null}
          {data.invoice ? (
            <div className="rounded-md border p-3">
              <p className="font-medium">Invoice {data.invoice.invoiceNumber}</p>
              <div className="mt-2 flex items-center gap-2">
                <InvoiceStatusBadge status={data.invoice.status} />
                <span className="text-muted-foreground">
                  Due ₹{data.invoice.dueAmount.toFixed(2)} / Total ₹{data.invoice.totalAmount.toFixed(2)}
                </span>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
