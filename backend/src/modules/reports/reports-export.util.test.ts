import { describe, expect, it } from 'vitest';

import {
  buildContentDispositionForExport,
  buildExportFilename,
  buildExportHttpDescriptor,
  extensionForExportFormat,
  mimeTypeForExportFormat,
  sanitizeAttachmentFilename,
  ensureFilenameExtensionMatchesFormat,
} from './reports-export.util';

describe('reports-export.util', () => {
  const fixed = new Date('2026-05-12T10:00:00.000Z');

  it('mimeTypeForExportFormat maps csv, xlsx, pdf', () => {
    expect(mimeTypeForExportFormat('csv')).toBe('text/csv');
    expect(mimeTypeForExportFormat('xlsx')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(mimeTypeForExportFormat('pdf')).toBe('application/pdf');
  });

  it('extensionForExportFormat matches format', () => {
    expect(extensionForExportFormat('csv')).toBe('csv');
    expect(extensionForExportFormat('pdf')).toBe('pdf');
    expect(extensionForExportFormat('xlsx')).toBe('xlsx');
  });

  it('buildExportFilename includes date and correct extension', () => {
    expect(buildExportFilename('students-report', 'pdf', fixed)).toBe('students-report-2026-05-12.pdf');
    expect(buildExportFilename('payments-report', 'csv', fixed)).toBe('payments-report-2026-05-12.csv');
    expect(buildExportFilename('payments-report', 'xlsx', fixed)).toBe('payments-report-2026-05-12.xlsx');
  });

  it('ensureFilenameExtensionMatchesFormat forces extension', () => {
    expect(ensureFilenameExtensionMatchesFormat('foo.pdf', 'csv')).toBe('foo.csv');
    expect(ensureFilenameExtensionMatchesFormat('bar', 'xlsx')).toBe('bar.xlsx');
  });

  it('sanitizeAttachmentFilename keeps safe characters', () => {
    expect(sanitizeAttachmentFilename('a-b_c.d.pdf')).toBe('a-b_c.d.pdf');
    expect(sanitizeAttachmentFilename('bad name!.pdf')).toBe('bad_name_.pdf');
  });

  it('buildContentDispositionForExport is attachment with quoted filename', () => {
    const cd = buildContentDispositionForExport('students-report-2026-05-12.pdf', 'pdf');
    expect(cd.startsWith('attachment;')).toBe(true);
    expect(cd).toContain('filename="students-report-2026-05-12.pdf"');
  });

  it('buildExportHttpDescriptor aligns type, name, and disposition', () => {
    const d = buildExportHttpDescriptor('dues-report', 'xlsx', fixed);
    expect(d.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(d.filename).toBe('dues-report-2026-05-12.xlsx');
    expect(d.contentDisposition).toContain('dues-report-2026-05-12.xlsx');
  });
});
