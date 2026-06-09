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
import { formatEntityLabel } from '@/lib/entity-label';
import { studentApi } from '@/modules/students/student.service';
import type { Student } from '@/modules/students/types';

function studentLabel(s: Student): string {
  return formatEntityLabel(s as unknown as Record<string, unknown>, 'student');
}

export interface StudentSelectProps {
  id?: string;
  label?: string;
  libraryId: string | null;
  branchId: string | null;
  value: string;
  onChange: (studentId: string, student?: Student) => void;
  disabled?: boolean;
  /** Shown when library or branch is missing. Defaults to "Select library and branch first." */
  pendingMessage?: string;
  searchPlaceholder?: string;
}

export function StudentSelect({
  id,
  label = 'Student',
  libraryId,
  branchId,
  value,
  onChange,
  disabled,
  pendingMessage = 'Select library and branch first.',
  searchPlaceholder = 'Search name, student ID, phone, seat…',
}: StudentSelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 300);

  const enabled = Boolean(libraryId && branchId) && !disabled;

  const { data, isLoading } = useQuery({
    queryKey: ['selector-students', libraryId, branchId, debounced],
    queryFn: () =>
      studentApi.list({
        libraryId: libraryId!,
        branchId: branchId!,
        limit: 40,
        page: 1,
        search: debounced.trim() || undefined,
        sortBy: 'fullName',
        sortOrder: 'asc',
      }),
    enabled,
  });

  const selected = data?.items.find((s) => s._id === value);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {!libraryId || !branchId ? (
        <p className="text-sm text-muted-foreground">{pendingMessage}</p>
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
                    <span className="font-medium">{selected.fullName}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {selected.studentId}
                      {selected.phone ? ` · ${selected.phone}` : ''}
                    </span>
                  </>
                ) : (
                  'Select student…'
                )}
              </span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <div className="border-b p-2">
              <Input
                placeholder={searchPlaceholder}
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
                    Loading students…
                  </div>
                ) : !data?.items.length ? (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">No students found.</p>
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
                      <span className="font-medium">{s.fullName}</span>
                      <span className="text-xs text-muted-foreground">
                        {studentLabel(s)}
                        {(s as Student & { seatNumber?: string }).seatNumber
                          ? ` · Seat ${(s as Student & { seatNumber?: string }).seatNumber}`
                          : ''}
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
