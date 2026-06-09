'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS } from '@/constants/permissions';
import { PAYMENTS_COLLECT } from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { paymentApi } from '@/modules/payments/payment.service';
import { paymentQueryKeys } from '@/modules/payments/payment-query-keys';
import { InvoiceStatusBadge } from '@/modules/payments/components/invoice-status-badge';
import { formatEntityLabel } from '@/lib/entity-label';

export default function InvoiceDetailPage() {
  const params = useParams<{ invoiceId: string }>();
  const invoiceId = params.invoiceId;
  const { can } = usePermissions();
  const { data, isLoading, error } = useQuery({
    queryKey: paymentQueryKeys.invoice(invoiceId),
    queryFn: () => paymentApi.getInvoice(invoiceId),
    enabled: Boolean(invoiceId) && can(PERMISSIONS.PAYMENT_READ),
  });

  if (!can(PERMISSIONS.PAYMENT_READ)) {
    return <p className="text-sm text-muted-foreground">No payment.read permission.</p>;
  }

  if (isLoading) return <Skeleton className="h-48 w-full rounded-xl" />;
  if (error || !data) return <p className="text-sm text-muted-foreground">Unable to load invoice.</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.invoiceNumber}
        description={`Total ₹${data.totalAmount.toFixed(2)} · Due ₹${data.dueAmount.toFixed(2)}`}
        actions={
          can(PERMISSIONS.PAYMENT_CREATE) && data.status !== 'CANCELLED' && data.status !== 'DRAFT' ? (
            <Button asChild>
              <Link href={`${PAYMENTS_COLLECT}?invoiceId=${data._id}`}>Collect</Link>
            </Button>
          ) : null
        }
      />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Status</CardTitle>
          <InvoiceStatusBadge status={data.status} />
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Student:</span>{' '}
            {formatEntityLabel(data, 'student')}
          </p>
          {data.branchName ? (
            <p>
              <span className="text-muted-foreground">Branch:</span> {formatEntityLabel(data, 'branch')}
            </p>
          ) : null}
          <p>
            <span className="text-muted-foreground">Due date:</span> {data.dueDate?.slice(0, 10)}
          </p>
          <p>
            <span className="text-muted-foreground">Paid:</span> ₹{data.paidAmount.toFixed(2)}
          </p>
          {data.notes ? (
            <p className="sm:col-span-2">
              <span className="text-muted-foreground">Notes:</span> {data.notes}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
