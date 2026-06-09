'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import type { SubscriptionPlanRef } from '@/modules/library/types';
import { platformApi } from '@/modules/platform/platform.service';
import { platformQueryKeys } from '@/modules/platform/platform-query-keys';

export type PlatformTenantOption = {
  id: string;
  name: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  status?: string;
  subscriptionPlan?: string;
  plan?: SubscriptionPlanRef;
  subscription?: {
    planName?: string;
    status?: string;
    badgeLabel?: string;
    expiryState?: string;
  };
};

export interface PlatformTenantSelectProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (libraryId: string, tenant?: PlatformTenantOption) => void;
  disabled?: boolean;
}

function tenantLabel(t: PlatformTenantOption): string {
  const sub = t.plan?.displayName ?? t.subscription?.planName ?? t.subscriptionPlan ?? '—';
  const st = t.subscription?.badgeLabel ?? t.subscription?.status ?? t.status ?? '';
  return `${t.name}${st ? ` · ${st}` : ''} · ${sub}`;
}

export function PlatformTenantSelect({
  id,
  label = 'Library',
  value,
  onChange,
  disabled,
}: PlatformTenantSelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 300);

  const { data, isLoading } = useQuery({
    queryKey: platformQueryKeys.tenants({ search: debounced, limit: '50', page: '1' }),
    queryFn: () =>
      platformApi.tenants({
        page: '1',
        limit: '50',
        search: debounced.trim() || undefined,
      }),
    enabled: open && !disabled,
  });

  const items = ((data?.data.items ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id ?? row._id),
    name: String(row.name ?? ''),
    ownerName: row.ownerName != null ? String(row.ownerName) : null,
    ownerEmail: row.ownerEmail != null ? String(row.ownerEmail) : null,
    status: row.status != null ? String(row.status) : undefined,
    subscriptionPlan: row.subscriptionPlan != null ? String(row.subscriptionPlan) : undefined,
    plan: row.plan as PlatformTenantOption['plan'],
    subscription: row.subscription as PlatformTenantOption['subscription'],
  })) as PlatformTenantOption[];

  const selected = items.find((t) => t.id === value);

  const { data: cachedSelected } = useQuery({
    queryKey: platformQueryKeys.tenant(value),
    queryFn: () => platformApi.tenant(value),
    enabled: Boolean(value) && !selected,
  });

  const display =
    selected ??
    (value && cachedSelected?.library
      ? ({
          id: value,
          name: String((cachedSelected.library as { name?: string }).name ?? ''),
          ownerName: null,
          ownerEmail: null,
        } as PlatformTenantOption)
      : undefined);

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
            <span className="line-clamp-2 pr-2 text-sm">
              {display ? (
                <>
                  <span className="font-medium">{display.name}</span>
                  {display.ownerEmail ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">{display.ownerEmail}</span>
                  ) : null}
                </>
              ) : (
                'Search library by name…'
              )}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="border-b p-2">
            <Input
              placeholder="Search library, slug, email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9"
            />
          </div>
          <ScrollArea className="h-64">
            <div className="p-1">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading…
                </div>
              ) : !items.length ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">No libraries found.</p>
              ) : (
                items.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={cn(
                      'flex w-full flex-col gap-0.5 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent',
                      value === t.id && 'bg-accent',
                    )}
                    onClick={() => {
                      onChange(t.id, t);
                      setOpen(false);
                    }}
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.ownerName || t.ownerEmail || 'No owner'}
                      {t.ownerEmail && t.ownerName ? ` · ${t.ownerEmail}` : ''}
                    </span>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      <Badge variant="outline" className="text-[10px]">
                        {t.plan?.displayName ?? t.subscription?.planName ?? t.subscriptionPlan ?? 'Plan'}
                      </Badge>
                      {(t.subscription?.badgeLabel ?? t.status) ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {t.subscription?.badgeLabel ?? t.status}
                        </Badge>
                      ) : null}
                    </div>
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
