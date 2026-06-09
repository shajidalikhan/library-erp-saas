'use client';

import { ReportColumnSettings } from '@/modules/reports/components/report-column-settings';
import { ReportExportButtons } from '@/modules/reports/components/report-export-buttons';
import { useReportColumns } from '@/modules/reports/hooks/use-report-columns';
import type { ReportColumnDef, ReportType } from '@/modules/reports/report-column-definitions';
import type { ReportListParams } from '@/modules/reports/types';

type ControlledColumns = ReturnType<typeof useReportColumns>;

export function ReportsExportToolbar({
  report,
  exportPath,
  fileBaseName,
  params,
  disabled,
  columns: controlled,
}: {
  report: ReportType;
  exportPath: string;
  fileBaseName: string;
  params: ReportListParams;
  disabled?: boolean;
  columns?: ControlledColumns;
}) {
  const internal = useReportColumns(report);
  const columnDefs = controlled?.columnDefs ?? internal.columnDefs;
  const selectedKeys = controlled?.selectedKeys ?? internal.selectedKeys;
  const onToggle = controlled?.toggleColumn ?? internal.toggleColumn;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ReportColumnSettings columnDefs={columnDefs} selectedKeys={selectedKeys} onToggle={onToggle} />
      <ReportExportButtons
        exportPath={exportPath}
        fileBaseName={fileBaseName}
        params={params}
        columns={selectedKeys.join(',')}
        disabled={disabled}
      />
    </div>
  );
}
