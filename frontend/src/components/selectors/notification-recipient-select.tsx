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
import { notificationsApi } from '@/modules/notifications/notifications.service';
import { notificationsQueryKeys } from '@/modules/notifications/notifications-query-keys';
import type { NotificationRecipientRow } from '@/modules/notifications/types';

export interface NotificationRecipientSelectProps {
  id?: string;
  label?: string;
  /** Tenant library (required for search). */
  libraryId: string | null;
  /** Optional branch filter (owner); managers are scoped server-side. */
  branchId?: string | null;
  value: string;
  onChange: (userId: string, user?: NotificationRecipientRow) => void;
  disabled?: boolean;
}

export function NotificationRecipientSelect({
  id,
  label = 'Recipient',
  libraryId,
  branchId,
  value,
  onChange,
  disabled,
}: NotificationRecipientSelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 300);

  const enabled = Boolean(libraryId) && open && !disabled;

  const { data, isLoading, isError } = useQuery({
    queryKey: notificationsQueryKeys.recipients({
      libraryId: libraryId ?? '',
      branchId: branchId ?? '',
      q: debounced.trim() || '',
      page: '1',
      limit: '40',
    }),
    queryFn: () =>
      notificationsApi.listRecipients({
        libraryId: libraryId!,
        ...(branchId ? { branchId } : {}),
        ...(debounced.trim() ? { q: debounced.trim() } : {}),
        page: '1',
        limit: '40',
      }),
    enabled,
  });

  const items = data?.data.items ?? [];
  const selected = items.find((u) => u.userId === value);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {!libraryId ? (
        <p className="text-sm text-muted-foreground">Select library workspace first.</p>
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
              className="w-full justify-between font-normal"
            >
              <span className="truncate">
                {selected ? `${selected.fullName} (${selected.email})` : 'Search users…'}
              </span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <div className="border-b p-2">
              <Input
                placeholder="Name, email, phone, or role…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-9"
              />
            </div>
            <ScrollArea className="h-60">
              <div className="p-1">
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Searching…
                  </div>
                ) : isError ? (
                  <p className="px-2 py-6 text-center text-sm text-destructive">Could not load users.</p>
                ) : !items.length ? (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">No users match.</p>
                ) : (
                  items.map((u) => (
                    <button
                      key={u.userId}
                      type="button"
                      className={cn(
                        'flex w-full flex-col rounded-sm px-2 py-2 text-left text-sm hover:bg-accent',
                        value === u.userId && 'bg-accent',
                      )}
                      onClick={() => {
                        onChange(u.userId, u);
                        setOpen(false);
                      }}
                    >
                      <span className="font-medium">{u.fullName}</span>
                      <span className="text-xs text-muted-foreground">
                        {u.email}
                        {u.role ? ` · ${u.role}` : ''}
                        {u.branchName ? ` · ${u.branchName}` : ''}
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
