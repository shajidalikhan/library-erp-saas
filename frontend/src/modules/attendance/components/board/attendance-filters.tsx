'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type AttendanceStatusFilter =
  | 'all'
  | 'checked_in'
  | 'checked_out'
  | 'auto_checked_out'
  | 'not_checked_in'
  | 'late';

export function AttendanceFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  shiftId,
  onShiftChange,
  shifts,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: AttendanceStatusFilter;
  onStatusFilterChange: (v: AttendanceStatusFilter) => void;
  shiftId: string;
  onShiftChange: (id: string) => void;
  shifts: Array<{ _id: string; name: string }>;
}) {
  const pills: { id: AttendanceStatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'checked_in', label: 'Checked in' },
    { id: 'checked_out', label: 'Checked out' },
    { id: 'auto_checked_out', label: 'Auto checked out' },
    { id: 'not_checked_in', label: 'Not checked in' },
    { id: 'late', label: 'Late' },
  ];

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-1 flex-wrap gap-2">
        {pills.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onStatusFilterChange(p.id)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              statusFilter === p.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="space-y-1 min-w-[140px]">
          <Label className="text-xs">Shift</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={shiftId}
            onChange={(e) => onShiftChange(e.target.value)}
          >
            <option value="">All shifts</option>
            {shifts.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 min-w-[200px] flex-1">
          <Label className="text-xs">Search</Label>
          <Input
            placeholder="Name, code, phone, seat…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9"
          />
        </div>
      </div>
    </div>
  );
}
