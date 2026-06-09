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
import { libraryApi } from '@/modules/library/library.service';
import type { Branch } from '@/modules/library/types';

export interface BranchSelectProps {
  id?: string;
  label?: string;
  libraryId: string | null;
  value: string;
  onChange: (branchId: string, branch?: Branch) => void;
  disabled?: boolean;
  /** When set, shows this branch as read-only (no picker). */
  lockedBranch?: Branch | null;
  /** Load and lock display when both are set and `lockedBranch` is not passed. */
  lockedLibraryId?: string | null;
  lockedBranchId?: string | null;
}

export function BranchSelect({
  id,
  label = 'Branch',
  libraryId,
  value,
  onChange,
  disabled,
  lockedBranch,
  lockedLibraryId,
  lockedBranchId,
}: BranchSelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 300);

  const { data: fetchedLock } = useQuery({
    queryKey: ['selector-branch-lock', lockedLibraryId, lockedBranchId],
    queryFn: () => libraryApi.getBranch(lockedLibraryId!, lockedBranchId!),
    enabled: Boolean(!lockedBranch && lockedLibraryId && lockedBranchId),
  });

  const resolvedLock = lockedBranch ?? fetchedLock;

  const { data, isLoading } = useQuery({
    queryKey: ['selector-branches', libraryId, debounced],
    queryFn: () => libraryApi.listBranches(libraryId!, { limit: 100, search: debounced.trim() || undefined }),
    enabled: Boolean(libraryId) && open && !disabled && !resolvedLock,
  });

  if (resolvedLock) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
        <div
          id={id}
          className="flex h-10 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground"
        >
          {resolvedLock.branchName} <span className="ml-2 text-xs">({resolvedLock.branchCode})</span>
        </div>
      </div>
    );
  }

  const selected = data?.items.find((b) => b._id === value);

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
                {selected ? `${selected.branchName} (${selected.branchCode})` : 'Select branch…'}
              </span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <div className="border-b p-2">
              <Input
                placeholder="Search branch…"
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
                    Loading branches…
                  </div>
                ) : !data?.items.length ? (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">No branches found.</p>
                ) : (
                  data.items.map((br) => (
                    <button
                      key={br._id}
                      type="button"
                      className={cn(
                        'flex w-full flex-col rounded-sm px-2 py-2 text-left text-sm hover:bg-accent',
                        value === br._id && 'bg-accent',
                      )}
                      onClick={() => {
                        onChange(br._id, br);
                        setOpen(false);
                      }}
                    >
                      <span className="font-medium">{br.branchName}</span>
                      <span className="text-xs text-muted-foreground">{br.branchCode}</span>
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
