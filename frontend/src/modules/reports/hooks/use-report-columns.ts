'use client';

import { useCallback, useMemo, useState } from 'react';

import {
  defaultReportColumnKeys,
  REPORT_COLUMN_DEFS,
  type ReportType,
} from '@/modules/reports/report-column-definitions';

const storageKey = (report: ReportType) => `library-erp:report-columns:${report}`;

function readStored(report: ReportType): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(report));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function useReportColumns(report: ReportType) {
  const allowed = useMemo(() => new Set(REPORT_COLUMN_DEFS[report].map((c) => c.key)), [report]);
  const defaults = useMemo(() => defaultReportColumnKeys(report), [report]);

  const [selectedKeys, setSelectedKeys] = useState<string[]>(() => {
    const stored = readStored(report);
    if (!stored?.length) return defaults;
    const valid = stored.filter((k) => allowed.has(k));
    return valid.length ? valid : defaults;
  });

  const persist = useCallback(
    (keys: string[]) => {
      const valid = keys.filter((k) => allowed.has(k));
      const next = valid.length ? valid : defaults;
      setSelectedKeys(next);
      localStorage.setItem(storageKey(report), JSON.stringify(next));
    },
    [allowed, defaults, report],
  );

  const toggleColumn = useCallback(
    (key: string, checked: boolean) => {
      persist(
        checked
          ? [...selectedKeys, key].filter((k, i, arr) => arr.indexOf(k) === i)
          : selectedKeys.filter((k) => k !== key),
      );
    },
    [persist, selectedKeys],
  );

  return {
    selectedKeys,
    setSelectedKeys: persist,
    toggleColumn,
    columnDefs: REPORT_COLUMN_DEFS[report],
  };
}
