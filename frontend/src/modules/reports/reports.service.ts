import { apiClient } from '@/lib/axios';
import { request } from '@/lib/axios';

import {
  getExportFilename,
  getExportMimeType,
  getResponseHeader,
} from '@/modules/reports/export-download';
import type { ExportFormat, ReportListEnvelope, ReportListParams } from './types';

function toParams(p: ReportListParams): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = String(v);
  }
  return Object.keys(out).length ? out : undefined;
}

export type DownloadReportOptions = {
  /** Used when `Content-Disposition` is missing (e.g. CORS misconfiguration). */
  fallbackBase?: string;
};

export async function downloadReportFile(
  urlPath: string,
  params: ReportListParams & { format: ExportFormat },
  options?: DownloadReportOptions,
): Promise<void> {
  const format = params.format;
  const fallbackBase = options?.fallbackBase ?? 'report';

  const search = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params })) {
    if (v === undefined || v === null || v === '') continue;
    search.set(k, String(v));
  }

  const res = await apiClient.get<Blob>(`${urlPath}?${search.toString()}`, {
    responseType: 'blob',
  });

  const contentTypeRaw = getResponseHeader(res.headers, 'content-type');
  const dispositionRaw = getResponseHeader(res.headers, 'content-disposition');

  const mime = getExportMimeType(contentTypeRaw, format);
  const filename = getExportFilename(dispositionRaw, format, fallbackBase);

  const blobSource = res.data;
  const blob =
    blobSource instanceof Blob ? new Blob([blobSource], { type: mime }) : new Blob([blobSource as BlobPart], { type: mime });

  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

export const reportsApi = {
  students: (p: ReportListParams) =>
    request<ReportListEnvelope<Record<string, unknown>>>({ url: '/reports/students', method: 'GET', params: toParams(p) }),

  attendance: (p: ReportListParams) =>
    request<ReportListEnvelope<Record<string, unknown>>>({ url: '/reports/attendance', method: 'GET', params: toParams(p) }),

  payments: (p: ReportListParams) =>
    request<ReportListEnvelope<Record<string, unknown>>>({ url: '/reports/payments', method: 'GET', params: toParams(p) }),

  invoices: (p: ReportListParams) =>
    request<ReportListEnvelope<Record<string, unknown>>>({ url: '/reports/invoices', method: 'GET', params: toParams(p) }),

  seats: (p: ReportListParams) =>
    request<ReportListEnvelope<Record<string, unknown>>>({ url: '/reports/seats', method: 'GET', params: toParams(p) }),

  dues: (p: ReportListParams) =>
    request<ReportListEnvelope<Record<string, unknown>>>({ url: '/reports/dues', method: 'GET', params: toParams(p) }),

  branches: (p: ReportListParams) =>
    request<ReportListEnvelope<Record<string, unknown>>>({ url: '/reports/branches', method: 'GET', params: toParams(p) }),

  collectionsDaily: (p: ReportListParams) =>
    request<{ series: Array<{ date: string; amount: number; count: number }>; totalAmount: number; range: { from: string; to: string } }>({
      url: '/reports/collections/daily',
      method: 'GET',
      params: toParams(p),
    }),

  collectionsMonthly: (p: ReportListParams) =>
    request<{ series: Array<{ month: string; amount: number; count: number }>; totalAmount: number; range: { from: string; to: string } }>({
      url: '/reports/collections/monthly',
      method: 'GET',
      params: toParams(p),
    }),
};
