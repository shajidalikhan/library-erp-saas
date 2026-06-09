'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { paymentApi } from '@/modules/payments/payment.service';
import type { Invoice } from '@/modules/payments/types';

function invoiceOptionLabel(inv: Invoice): string {
  const name = inv.studentName?.trim() || '—';
  const code = inv.studentCode?.trim() || '—';
  const seat = inv.seatNumber?.trim() ? `Seat ${inv.seatNumber}` : 'No seat';
  const due = formatCurrency(inv.dueAmount, inv.currency ?? 'INR');
  return `${name} · ${code} · ${seat} · Due ${due}`;
}

export interface InvoiceSelectProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (invoiceId: string, invoice: Invoice | null) => void;
  libraryId?: string | null;
  branchId?: string | null;
  disabled?: boolean;
  /** When true, only invoices with open balance (collectable). Default true. */
  collectableOnly?: boolean;
  /** When the selected invoice is known outside the popover query (e.g. deep link prefetch). */
  selectedInvoice?: Invoice | null;
  /** When set, only this student's open invoices are listed. */
  studentId?: string | null;
  /** When set with `studentId`, shown when the student has no open invoices. */
  onCreateForStudent?: () => void;
}

export function InvoiceSelect({
  id,
  label = 'Invoice',
  value,
  onChange,
  libraryId,
  branchId,
  disabled,
  collectableOnly = true,
  selectedInvoice,
  studentId,
  onCreateForStudent,
}: InvoiceSelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 300);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['selector-invoices', libraryId, branchId, studentId, debounced, collectableOnly],
    queryFn: () =>
      paymentApi.listInvoices({
        search: debounced.trim() || undefined,
        libraryId: libraryId ?? undefined,
        branchId: branchId ?? undefined,
        studentId: studentId ?? undefined,
        hasOpenBalance: collectableOnly ? true : undefined,
        limit: 40,
        page: 1,
        sortBy: 'dueDate',
        sortOrder: 'asc',
      }),
    enabled: open && !disabled && (studentId ? Boolean(studentId) : true),
  });

  const selected =
    value && selectedInvoice && selectedInvoice._id === value
      ? selectedInvoice
      : data?.items.find((i) => i._id === value);

  return (
    <div className="space-y-2">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="h-auto min-h-10 w-full justify-between py-2 text-left font-normal"
          >
            <span className="line-clamp-2 pr-2 text-left text-sm">
              {selected ? (
                <>
                  <span className="font-mono text-xs font-medium">{selected.invoiceNumber}</span>
                  <span className="block text-muted-foreground">{invoiceOptionLabel(selected)}</span>
                </>
              ) : (
                'Search invoice…'
              )}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,28rem)] p-0" align="start">
          <div className="border-b p-2">
            <Input
              placeholder="Invoice #, student, phone, ID, seat…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9"
            />
          </div>
          <ScrollArea className="h-72">
            <div className="p-1">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading invoices…
                </div>
              ) : isError ? (
                <div className="space-y-2 px-2 py-4 text-sm text-destructive">
                  <p>{error instanceof Error ? error.message : 'Failed to load'}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
                    Retry
                  </Button>
                </div>
              ) : !data?.items.length ? (
                <div className="space-y-1 px-1 py-2">
                  <p className="px-2 py-4 text-center text-sm text-muted-foreground">No open invoices found.</p>
                  {studentId && onCreateForStudent ? (
                    <button
                      type="button"
                      className="flex w-full rounded-sm px-2 py-2 text-left text-sm font-medium text-primary hover:bg-accent"
                      onClick={() => {
                        onCreateForStudent();
                        setOpen(false);
                      }}
                    >
                      Create invoice for this student
                    </button>
                  ) : null}
                </div>
              ) : (
                data.items.map((inv) => (
                  <button
                    key={inv._id}
                    type="button"
                    className={cn(
                      'flex w-full flex-col rounded-sm px-2 py-2 text-left text-sm hover:bg-accent',
                      value === inv._id && 'bg-accent',
                    )}
                    onClick={() => {
                      onChange(inv._id, inv);
                      setOpen(false);
                    }}
                  >
                    <span className="font-mono text-xs font-medium">{inv.invoiceNumber}</span>
                    <span className="line-clamp-2 text-left text-xs text-muted-foreground">{invoiceOptionLabel(inv)}</span>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}
