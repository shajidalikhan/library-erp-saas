'use client';

import { Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ReportColumnDef } from '@/modules/reports/report-column-definitions';

export function ReportColumnSettings({
  columnDefs,
  selectedKeys,
  onToggle,
}: {
  columnDefs: ReportColumnDef[];
  selectedKeys: string[];
  onToggle: (key: string, checked: boolean) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" aria-label="Column settings">
          <Settings2 className="mr-1 h-3.5 w-3.5" aria-hidden />
          Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <p className="mb-2 text-sm font-medium">Visible columns</p>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {columnDefs.map((col) => (
            <div key={col.key} className="flex items-center gap-2">
              <input
                id={`col-${col.key}`}
                type="checkbox"
                className="h-4 w-4 rounded border border-input"
                checked={selectedKeys.includes(col.key)}
                onChange={(e) => onToggle(col.key, e.target.checked)}
              />
              <Label htmlFor={`col-${col.key}`} className="text-sm font-normal">
                {col.label}
              </Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
