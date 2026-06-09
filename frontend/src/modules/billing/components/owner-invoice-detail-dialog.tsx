'use client';

import { useQuery } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { billingApi } from '@/modules/billing/billing.service';

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export function OwnerInvoiceDetailDialog({
  invoiceId,
  open,
  onOpenChange,
}: {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const q = useQuery({
    queryKey: ['billing', 'subscription-invoice', invoiceId],
    queryFn: () => billingApi.invoice(invoiceId!),
    enabled: open && Boolean(invoiceId),
  });

  const inv = q.data as Record<string, unknown> | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invoice {String(inv?.invoiceNumber ?? '')}</DialogTitle>
        </DialogHeader>
        {q.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : q.isError ? (
          <p className="text-sm text-destructive">Could not load invoice details.</p>
        ) : inv ? (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{String(inv.status)}</Badge>
              <span className="text-muted-foreground">{String(inv.planName)} · {String(inv.billingCycle)}</span>
            </div>
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Issue date</dt>
                <dd>{fmtDate(inv.issueDate)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Due date</dt>
                <dd>{fmtDate(inv.dueDate)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Subscription start</dt>
                <dd>{fmtDate(inv.subscriptionStartDate)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Subscription end</dt>
                <dd>{fmtDate(inv.subscriptionEndDate)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Amount</dt>
                <dd className="font-medium">{formatCurrency(Number(inv.amount ?? 0))}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Paid</dt>
                <dd>{formatCurrency(Number(inv.paidAmount ?? 0))}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Due</dt>
                <dd className="font-semibold">{formatCurrency(Number(inv.dueAmount ?? 0))}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Payment method</dt>
                <dd>{String(inv.paymentMethod ?? '—')}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase text-muted-foreground">Transaction ID</dt>
                <dd className="font-mono text-xs">{String(inv.transactionId ?? '—')}</dd>
              </div>
              {inv.notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase text-muted-foreground">Notes</dt>
                  <dd className="whitespace-pre-wrap">{String(inv.notes)}</dd>
                </div>
              ) : null}
              {inv.paidAt ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase text-muted-foreground">Last payment</dt>
                  <dd>
                    {fmtDate(inv.paidAt)} · {formatCurrency(Number(inv.paidAmount ?? 0))}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled title="PDF download coming soon">
              Download invoice
            </Button>
            <Button type="button" variant="outline" disabled title="Print coming soon" onClick={() => window.print()}>
              Print invoice
            </Button>
          </div>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
