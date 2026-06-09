'use client';

import { LibrarySelect } from '@/components/selectors/library-select';
import { BranchSelect } from '@/components/selectors/branch-select';
import { Label } from '@/components/ui/label';
import type { AnalyticsRangePreset } from '@/modules/analytics/types';

const RANGES: { value: AnalyticsRangePreset; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '365d', label: 'Last 12 months' },
];

export function AnalyticsFiltersBar({
  isSuper,
  libraryId,
  branchId,
  range,
  onLibraryChange,
  onBranchChange,
  onRangeChange,
}: {
  isSuper: boolean;
  libraryId: string;
  branchId: string;
  range: AnalyticsRangePreset;
  onLibraryChange: (id: string) => void;
  onBranchChange: (id: string) => void;
  onRangeChange: (r: AnalyticsRangePreset) => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 lg:flex-row lg:flex-wrap lg:items-end">
      {isSuper ? (
        <>
          <div className="min-w-[200px] flex-1 space-y-2">
            <LibrarySelect label="Library" value={libraryId} onChange={onLibraryChange} />
          </div>
          <div className="min-w-[200px] flex-1 space-y-2">
            <BranchSelect
              label="Branch"
              libraryId={libraryId || null}
              value={branchId}
              onChange={onBranchChange}
            />
          </div>
        </>
      ) : null}
      <div className="min-w-[180px] space-y-2">
        <Label htmlFor="analytics-range">Range</Label>
        <select
          id="analytics-range"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={range}
          onChange={(e) => onRangeChange(e.target.value as AnalyticsRangePreset)}
        >
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
