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
import type { Library } from '@/modules/library/types';

export interface LibrarySelectProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (libraryId: string, library?: Library) => void;
  disabled?: boolean;
}

export function LibrarySelect({ id, label = 'Library', value, onChange, disabled }: LibrarySelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['selector-libraries', debounced],
    queryFn: () => libraryApi.listLibraries({ limit: 80, search: debounced.trim() || undefined }),
    enabled: open && !disabled,
  });

  const selected = data?.items.find((l) => l._id === value);

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
            className="w-full justify-between font-normal"
          >
            <span className="truncate">{selected ? selected.name : 'Select library…'}</span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <div className="border-b p-2">
            <Input
              placeholder="Search name, slug…"
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
                  Loading libraries…
                </div>
              ) : !data?.items.length ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">No libraries found.</p>
              ) : (
                data.items.map((lib) => (
                  <button
                    key={lib._id}
                    type="button"
                    className={cn(
                      'flex w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-accent',
                      value === lib._id && 'bg-accent',
                    )}
                    onClick={() => {
                      onChange(lib._id, lib);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate font-medium">{lib.name}</span>
                    <span className="ml-2 truncate text-xs text-muted-foreground">{lib.slug}</span>
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
