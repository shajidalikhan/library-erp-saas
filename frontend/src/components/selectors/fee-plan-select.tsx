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
import { cn, formatCurrency } from '@/lib/utils';
import { paymentApi } from '@/modules/payments/payment.service';
import type { FeePlan } from '@/modules/payments/types';

export interface FeePlanSelectProps {
  id?: string;
  label?: string;
  libraryId: string | null;
  branchId: string | null;
  value: string | null;
  onChange: (feePlanId: string | null, plan?: FeePlan | null) => void;
  disabled?: boolean;
  allowClear?: boolean;
}

export function FeePlanSelect({
  id,
  label = 'Fee plan (optional)',
  libraryId,
  branchId,
  value,
  onChange,
  disabled,
  allowClear = true,
}: FeePlanSelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 300);

  const enabled = Boolean(libraryId && branchId) && open && !disabled;

  const { data, isLoading } = useQuery({
    queryKey: ['selector-fee-plans', libraryId, branchId, debounced],
    queryFn: () =>
      paymentApi.listFeePlans({
        libraryId: libraryId!,
        branchId: branchId!,
        active: true,
        limit: 50,
        search: debounced.trim() || undefined,
      }),
    enabled,
  });

  const selected = value ? data?.items.find((p) => p._id === value) : undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {!libraryId || !branchId ? (
        <p className="text-sm text-muted-foreground">Select library and branch first.</p>
      ) : (
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
                    <span className="font-medium">{selected.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {formatCurrency(selected.amount, 'INR')} · {selected.durationDays} days
                    </span>
                  </>
                ) : value ? (
                  'Loading plan…'
                ) : (
                  'No fee plan (manual amount)'
                )}
              </span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <div className="border-b p-2">
              <Input
                placeholder="Search plan name…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-9"
              />
            </div>
            <ScrollArea className="h-64">
              <div className="p-1">
                {allowClear ? (
                  <button
                    type="button"
                    className={cn(
                      'mb-1 w-full rounded-sm px-2 py-2 text-left text-sm text-muted-foreground hover:bg-accent',
                      !value && 'bg-accent text-foreground',
                    )}
                    onClick={() => {
                      onChange(null, null);
                      setOpen(false);
                    }}
                  >
                    Clear — manual amount
                  </button>
                ) : null}
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading fee plans…
                  </div>
                ) : !data?.items.length ? (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">No fee plans found.</p>
                ) : (
                  data.items.map((p) => (
                    <button
                      key={p._id}
                      type="button"
                      className={cn(
                        'flex w-full flex-col rounded-sm px-2 py-2 text-left text-sm hover:bg-accent',
                        value === p._id && 'bg-accent',
                      )}
                      onClick={() => {
                        onChange(p._id, p);
                        setOpen(false);
                      }}
                    >
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(p.amount, 'INR')} · {p.durationDays} days
                        {p.type ? ` · ${p.type.replace(/_/g, ' ')}` : ''}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
