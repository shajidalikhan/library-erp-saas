import { describe, expect, it } from 'vitest';

import {
  ensureDownloadFilename,
  getExportFilename,
  getExportMimeType,
  getResponseHeader,
} from './export-download';
import type { ExportFormat } from './types';

describe('export-download', () => {
  it('getExportMimeType prefers header primary type', () => {
    expect(getExportMimeType('application/pdf; charset=binary', 'csv')).toBe('application/pdf');
    expect(getExportMimeType('text/csv; charset=utf-8', 'pdf')).toBe('text/csv');
  });

  it('getExportMimeType falls back by format when header missing or generic', () => {
    expect(getExportMimeType(undefined, 'pdf')).toBe('application/pdf');
    expect(getExportMimeType('text/plain', 'csv')).toBe('text/csv');
    expect(getExportMimeType('application/octet-stream', 'xlsx')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });

  it('getExportFilename parses quoted filename', () => {
    const cd = 'attachment; filename="students-report-2026-05-12.pdf"';
    expect(getExportFilename(cd, 'pdf', 'fallback')).toBe('students-report-2026-05-12.pdf');
  });

  it('getExportFilename parses filename* UTF-8', () => {
    const cd = "attachment; filename*=UTF-8''payments-report-2026-05-12.xlsx";
    expect(getExportFilename(cd, 'xlsx', 'fallback')).toBe('payments-report-2026-05-12.xlsx');
  });

  it('getExportFilename forces extension to match format', () => {
    const cd = 'attachment; filename="wrong.pdf"';
    expect(getExportFilename(cd, 'csv', 'fallback')).toBe('wrong.csv');
  });

  it('getExportFilename uses fallback when header missing', () => {
    const name = getExportFilename(undefined, 'csv' as ExportFormat, 'dues-report');
    expect(name).toMatch(/^dues-report-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('ensureDownloadFilename normalizes extension', () => {
    expect(ensureDownloadFilename('a.pdf', 'csv')).toBe('a.csv');
  });

  it('getResponseHeader is case-insensitive', () => {
    expect(getResponseHeader({ 'Content-Type': 'application/pdf' }, 'content-type')).toBe('application/pdf');
    expect(getResponseHeader({ 'content-disposition': 'x' }, 'Content-Disposition')).toBe('x');
  });
});
