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
import { seatApi } from '@/modules/seats/seat.service';
import type { Seat } from '@/modules/seats/types';

function seatShiftHint(s: Seat): string | null {
  const rows = s.shiftAssignments;
  if (!rows?.length) return null;
  return rows
    .map((a) => {
      const sh = a.shiftId as { name?: string } | string | undefined;
      const name = typeof sh === 'object' && sh?.name ? sh.name : 'Shift';
      const st = a.studentId as { fullName?: string } | undefined;
      return st?.fullName ? `${name}: ${st.fullName}` : name;
    })
    .join('; ');
}

function seatLabel(s: Seat): string {
  const hint = seatShiftHint(s);
  const parts = [s.seatNumber, s.floor ? `Floor ${s.floor}` : null, s.zone, hint].filter(Boolean);
  return parts.join(' · ');
}

export interface SeatSelectProps {
  id?: string;
  label?: string;
  libraryId: string | null;
  branchId: string | null;
  value: string;
  onChange: (seatId: string, seat?: Seat) => void;
  disabled?: boolean;
  availableOnly?: boolean;
}

export function SeatSelect({
  id,
  label = 'Seat',
  libraryId,
  branchId,
  value,
  onChange,
  disabled,
  availableOnly = true,
}: SeatSelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 300);

  const enabled = Boolean(libraryId && branchId) && open && !disabled;

  const { data, isLoading } = useQuery({
    queryKey: ['selector-seats', libraryId, branchId, debounced, availableOnly],
    queryFn: () =>
      (availableOnly ? seatApi.listAvailable : seatApi.list)({
        libraryId: libraryId!,
        branchId: branchId!,
        limit: 50,
        page: 1,
        search: debounced.trim() || undefined,
        sortBy: 'seatNumber',
        sortOrder: 'asc',
      }),
    enabled,
  });

  const selected = data?.items.find((s) => s._id === value);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {!libraryId || !branchId ? (
        <p className="text-sm text-muted-foreground">Select a branch first.</p>
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
              <span className="line-clamp-2 pr-2 text-sm">
                {selected ? seatLabel(selected) : 'Select seat…'}
              </span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <div className="border-b p-2">
              <Input
                placeholder="Search seat number, floor, zone…"
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
                    Loading seats…
                  </div>
                ) : !data?.items.length ? (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">No seats found.</p>
                ) : (
                  data.items.map((s) => (
                    <button
                      key={s._id}
                      type="button"
                      className={cn(
                        'flex w-full flex-col rounded-sm px-2 py-2 text-left text-sm hover:bg-accent',
                        value === s._id && 'bg-accent',
                      )}
                      onClick={() => {
                        onChange(s._id, s);
                        setOpen(false);
                      }}
                    >
                      <span className="font-medium">{s.seatNumber}</span>
                      <span className="text-xs text-muted-foreground">
                        {[s.floor, s.zone, s.seatType, seatShiftHint(s)].filter(Boolean).join(' · ')}
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
