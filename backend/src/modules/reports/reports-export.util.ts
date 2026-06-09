import { stringify } from 'csv-stringify/sync';
import type { Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

/** MIME types for report downloads (no charset on CSV per API contract). */
export function mimeTypeForExportFormat(format: ExportFormat): string {
  switch (format) {
    case 'csv':
      return 'text/csv';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

/** File extension for the format (always matches format). */
export function extensionForExportFormat(format: ExportFormat): string {
  return format === 'xlsx' ? 'xlsx' : format;
}

/** `prefix-YYYY-MM-DD.ext` — extension always matches `format`. */
export function buildExportFilename(prefix: string, format: ExportFormat, date = new Date()): string {
  const safePrefix = prefix.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '') || 'report';
  const d = date.toISOString().slice(0, 10);
  const ext = extensionForExportFormat(format);
  return `${safePrefix}-${d}.${ext}`;
}

/** ASCII-safe name for Content-Disposition `filename="..."`. */
export function sanitizeAttachmentFilename(name: string): string {
  const trimmed = name.trim() || 'report';
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Ensures the basename ends with the correct extension for the export format.
 */
export function ensureFilenameExtensionMatchesFormat(filename: string, format: ExportFormat): string {
  const ext = extensionForExportFormat(format);
  const withoutExt = filename.replace(/\.(csv|xlsx|pdf)$/i, '');
  return `${withoutExt}.${ext}`;
}

/**
 * Build `Content-Disposition` when `format` is known (preferred).
 */
export function buildContentDispositionForExport(filename: string, format: ExportFormat): string {
  const finalName = sanitizeAttachmentFilename(ensureFilenameExtensionMatchesFormat(filename, format));
  return `attachment; filename="${finalName}"`;
}

export type ExportHttpDescriptor = {
  contentType: string;
  filename: string;
  contentDisposition: string;
};

/** Single place for MIME + filename + Content-Disposition for report exports. */
export function buildExportHttpDescriptor(filePrefix: string, format: ExportFormat, date = new Date()): ExportHttpDescriptor {
  const contentType = mimeTypeForExportFormat(format);
  const filename = buildExportFilename(filePrefix, format, date);
  return {
    contentType,
    filename,
    contentDisposition: buildContentDispositionForExport(filename, format),
  };
}

/**
 * Apply headers and send binary body. Does not alter business logic payloads.
 */
export function sendExportBinaryResponse(
  res: Response,
  body: Buffer,
  filePrefix: string,
  format: ExportFormat,
): void {
  const { contentType, contentDisposition } = buildExportHttpDescriptor(filePrefix, format);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', contentDisposition);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(body);
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  if (/^[=+\-@]/.test(s)) return `'${s}`;
  return s;
}

export function rowsToCsv(columns: string[], rows: Record<string, unknown>[]): Buffer {
  const records = rows.map((r) => {
    const o: Record<string, string> = {};
    for (const c of columns) {
      o[c] = cell(r[c]);
    }
    return o;
  });
  const out = stringify(records, { header: true, columns });
  return Buffer.from(out, 'utf-8');
}

export async function rowsToXlsx(
  sheetName: string,
  columns: string[],
  rows: Record<string, unknown>[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName.slice(0, 31));
  ws.columns = columns.map((c) => ({ header: c, key: c, width: 20 }));
  for (const r of rows) {
    const row: Record<string, unknown> = {};
    for (const c of columns) {
      row[c] = r[c] ?? '';
    }
    ws.addRow(row);
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function rowsToPdf(
  title: string,
  columns: string[],
  rows: Record<string, unknown>[],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(14).text(title, { underline: true });
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(8);

    const usable = doc.page.width - 72;
    const colWidth = usable / Math.max(columns.length, 1);
    let y = doc.y;
    const startX = 36;

    let x = startX;
    for (const c of columns) {
      doc.text(String(c).slice(0, 28), x, y, { width: colWidth - 2, ellipsis: true });
      x += colWidth;
    }
    y += 14;

    for (const r of rows) {
      if (y > doc.page.height - 40) {
        doc.addPage();
        y = 36;
      }
      x = startX;
      for (const c of columns) {
        doc.text(cell(r[c]).slice(0, 48), x, y, { width: colWidth - 2, ellipsis: true });
        x += colWidth;
      }
      y += 11;
    }
    doc.end();
  });
}

export async function buildExportBuffer(
  format: ExportFormat,
  title: string,
  columns: string[],
  rows: Record<string, unknown>[],
): Promise<Buffer> {
  switch (format) {
    case 'csv':
      return rowsToCsv(columns, rows);
    case 'xlsx':
      return rowsToXlsx(title, columns, rows);
    case 'pdf':
      return rowsToPdf(title, columns, rows);
    default:
      return rowsToCsv(columns, rows);
  }
}