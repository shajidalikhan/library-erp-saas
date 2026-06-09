'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2 } from 'lucide-react';
import { useSubscriptionFeatures } from '@/modules/subscription/hooks/use-subscription-features';
import { FEATURE_UPGRADE_TOOLTIPS } from '@/modules/subscription/plan-limit-messages';

import { downloadReportFile } from '@/modules/reports/reports.service';
import type { ExportFormat, ReportListParams } from '@/modules/reports/types';

export function ReportExportButtons({
  exportPath,
  fileBaseName,
  params,
  columns,
  disabled,
}: {
  exportPath: string;
  /** e.g. `students-report` — used for fallback filename and suggested download name. */
  fileBaseName: string;
  params: ReportListParams;
  columns?: string;
  disabled?: boolean;
}) {
  const busy = useRef(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const { hasFeature } = useSubscriptionFeatures();
  const exportsAllowed = hasFeature('exports');
  const blocked = disabled || !exportsAllowed;

  const run = async (format: ExportFormat) => {
    if (busy.current || disabled) return;
    busy.current = true;
    setExporting(format);
    toast.info('Export started', { description: `${fileBaseName}.${format}` });
    try {
      await downloadReportFile(
        exportPath,
        { ...params, format, columns: columns || undefined },
        { fallbackBase: fileBaseName },
      );
      toast.success('Export successful', { description: `${fileBaseName}.${format}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      toast.error('Export failed', { description: msg });
    } finally {
      busy.current = false;
      setExporting(null);
    }
  };

  const isBusy = exporting !== null;

  const buttons = (
    <div className="flex flex-wrap gap-2">
      {(['csv', 'xlsx', 'pdf'] as const).map((format) => (
        <Button
          key={format}
          type="button"
          variant="outline"
          size="sm"
          disabled={blocked || isBusy}
          onClick={() => run(format)}
        >
          {exporting === format ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden /> : null}
          {format === 'xlsx' ? 'Excel' : format.toUpperCase()}
        </Button>
      ))}
    </div>
  );

  if (!exportsAllowed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">{buttons}</span>
          </TooltipTrigger>
          <TooltipContent>{FEATURE_UPGRADE_TOOLTIPS.exports}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return buttons;
}
