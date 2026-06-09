'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { paymentReceiptRoute } from '@/constants/routes';
import { studentApi } from '@/modules/students/student.service';
import { InvoiceStatusBadge } from '@/modules/payments/components/invoice-status-badge';
import { PaymentMethodBadge } from '@/modules/payments/components/payment-method-badge';

export default function MyPaymentsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['student', 'me', 'payments'],
    queryFn: () => studentApi.myPayments(),
  });

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (isError || !data) {
    return <p className="text-sm text-muted-foreground">Unable to load payments.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Outstanding</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">₹{data.outstandingAmount.toFixed(2)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lifetime paid</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">₹{data.totalPaid.toFixed(2)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {data.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.invoices.map((inv) => (
                    <TableRow key={inv._id}>
                      <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
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
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payments & receipts</CardTitle>
        </CardHeader>
        <CardContent>
          {data.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Print</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payments.map((p) => (
                    <TableRow key={p._id}>
                      <TableCell className="font-mono text-xs">{p.receiptNumber}</TableCell>
                      <TableCell>{new Date(p.paidAt).toLocaleString()}</TableCell>
                      <TableCell>
                        <PaymentMethodBadge method={p.method} />
                      </TableCell>
                      <TableCell>₹{p.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Link href={paymentReceiptRoute(p._id)} className="text-xs text-primary hover:underline">
                          View receipt
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
