'use client';

import { LibrarySelect } from '@/components/selectors/library-select';
import { BranchSelect } from '@/components/selectors/branch-select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { ReportRangePreset } from '@/modules/reports/types';

const RANGES: { value: ReportRangePreset; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '365d', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom' },
];

export function ReportsFiltersBar({
  isSuper,
  libraryId,
  branchId,
  range,
  fromDate,
  toDate,
  onLibraryChange,
  onBranchChange,
  onRangeChange,
  onFromDateChange,
  onToDateChange,
}: {
  isSuper: boolean;
  libraryId: string;
  branchId: string;
  range: ReportRangePreset;
  fromDate: string;
  toDate: string;
  onLibraryChange: (id: string) => void;
  onBranchChange: (id: string) => void;
  onRangeChange: (r: ReportRangePreset) => void;
  onFromDateChange: (v: string) => void;
  onToDateChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 lg:flex-row lg:flex-wrap lg:items-end">
      {isSuper ? (
        <>
          <div className="min-w-[200px] flex-1 space-y-2">
            <LibrarySelect label="Library" value={libraryId} onChange={onLibraryChange} />
          </div>
          <div className="min-w-[200px] flex-1 space-y-2">
            <BranchSelect label="Branch" libraryId={libraryId || null} value={branchId} onChange={onBranchChange} />
          </div>
        </>
      ) : (
        <div className="min-w-[200px] flex-1 space-y-2">
          <BranchSelect label="Branch" libraryId={libraryId || null} value={branchId} onChange={onBranchChange} />
        </div>
      )}
      <div className="min-w-[180px] space-y-2">
        <Label htmlFor="reports-range">Range</Label>
        <select
          id="reports-range"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={range}
          onChange={(e) => onRangeChange(e.target.value as ReportRangePreset)}
        >
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      {range === 'custom' ? (
        <div className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label htmlFor="reports-from">From</Label>
            <Input id="reports-from" type="date" value={fromDate} onChange={(e) => onFromDateChange(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reports-to">To</Label>
            <Input id="reports-to" type="date" value={toDate} onChange={(e) => onToDateChange(e.target.value)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
