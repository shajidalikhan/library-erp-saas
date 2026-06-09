'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown, Loader2, Star } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, formatCurrency } from '@/lib/utils';
import { platformApi } from '@/modules/platform/platform.service';
import { platformQueryKeys } from '@/modules/platform/platform-query-keys';
import type { PlatformPlanOption } from '@/modules/subscription/subscription-invoice-form.utils';
import { formatPlanCode } from '@/modules/platform/subscription-plan-key.util';

export interface PlatformPlanSelectProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (planId: string, plan?: PlatformPlanOption) => void;
  disabled?: boolean;
}

function mapPlan(row: Record<string, unknown>): PlatformPlanOption {
  return {
    id: String(row.id ?? row._id),
    planKey: formatPlanCode(String(row.planKey ?? '')),
    displayName: String(row.displayName ?? ''),
    monthlyPrice: Number(row.monthlyPrice ?? 0),
    yearlyPrice: Number(row.yearlyPrice ?? 0),
    maxSeats: Number(row.maxSeats ?? 0),
    maxBranches: Number(row.maxBranches ?? 0),
    maxStaff: Number(row.maxStaff ?? 0),
    storageLimitMb: Number(row.storageLimitMb ?? 0),
    featureFlags:
      row.featureFlags && typeof row.featureFlags === 'object'
        ? (row.featureFlags as Record<string, boolean>)
        : {},
    sortOrder: row.sortOrder != null ? Number(row.sortOrder) : undefined,
  };
}

export function PlatformPlanSelect({ id, label = 'Plan', value, onChange, disabled }: PlatformPlanSelectProps) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: platformQueryKeys.plans(),
    queryFn: () => platformApi.plans(),
    enabled: open && !disabled,
  });

  const plans = ((data?.items ?? []) as Record<string, unknown>[])
    .filter((p) => p.active !== false)
    .map(mapPlan);

  const selected = plans.find((p) => p.id === value);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
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
            <span className="line-clamp-2 pr-2 text-sm">
              {selected ? (
                <>
                  <span className="font-medium">{selected.displayName}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {formatCurrency(selected.monthlyPrice)}/mo · {formatCurrency(selected.yearlyPrice)}/yr
                  </span>
                </>
              ) : (
                'Select subscription plan…'
              )}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <ScrollArea className="h-72">
            <div className="p-1">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading plans…
                </div>
              ) : !plans.length ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">No active plans.</p>
              ) : (
                plans.map((p) => {
                  const popular = p.sortOrder === 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={cn(
                        'flex w-full flex-col gap-1 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent',
                        value === p.id && 'bg-accent',
                      )}
                      onClick={() => {
                        onChange(p.id, p);
                        setOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.displayName}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{p.planKey}</span>
                        {popular ? (
                          <Badge className="gap-0.5 text-[10px]" variant="default">
                            <Star className="size-3" />
                            Popular
                          </Badge>
                        ) : null}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(p.monthlyPrice)}/mo · {formatCurrency(p.yearlyPrice)}/yr · {p.maxSeats}{' '}
                        seats · {p.maxBranches} branches
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}
