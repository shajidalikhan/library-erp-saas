import type { ExportFormat } from './types';

const FALLBACK_MIME: Record<ExportFormat, string> = {
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

/**
 * Prefer API `Content-Type`; fall back to format so the Blob is never `text/plain` by accident.
 */
export function getExportMimeType(contentTypeHeader: string | undefined, format: ExportFormat): string {
  const primary = contentTypeHeader?.split(';')[0]?.trim();
  const lower = primary?.toLowerCase();
  if (
    primary &&
    lower !== 'application/octet-stream' &&
    lower !== 'text/plain' &&
    lower !== 'text/html' &&
    lower !== 'application/json'
  ) {
    return primary;
  }
  return FALLBACK_MIME[format];
}

function extensionForFormat(format: ExportFormat): string {
  return format === 'xlsx' ? 'xlsx' : format;
}

/**
 * Ensures the download filename ends with the correct extension for the requested format.
 */
export function ensureDownloadFilename(name: string, format: ExportFormat): string {
  const ext = extensionForFormat(format);
  const base = name.replace(/\.(csv|xlsx|pdf)$/i, '').trim() || 'report';
  return `${base}.${ext}`;
}

function buildFallbackFilename(fallbackBase: string, format: ExportFormat): string {
  const safe = fallbackBase.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '') || 'report';
  const d = new Date().toISOString().slice(0, 10);
  return `${safe}-${d}.${extensionForFormat(format)}`;
}

/**
 * Parse `Content-Disposition` (RFC 5987 `filename*`, quoted `filename=`, or unquoted).
 */
export function getExportFilename(
  contentDispositionHeader: string | undefined,
  format: ExportFormat,
  fallbackBase: string,
): string {
  const fallback = buildFallbackFilename(fallbackBase, format);
  const cd = contentDispositionHeader?.trim();
  if (!cd) return fallback;

  const star = /filename\*=(?:UTF-8''|utf-8'')([^;\s]+)/i.exec(cd);
  if (star?.[1]) {
    try {
      const decoded = decodeURIComponent(star[1].replace(/^"(.*)"$/, '$1'));
      if (decoded) return ensureDownloadFilename(decoded, format);
    } catch {
      /* ignore */
    }
  }

  const quoted = /filename\s*=\s*"([^"]+)"/i.exec(cd);
  if (quoted?.[1]) return ensureDownloadFilename(quoted[1].trim(), format);

  const unquoted = /filename\s*=\s*([^;\s]+)/i.exec(cd);
  if (unquoted?.[1]) {
    const v = unquoted[1].trim().replace(/^"(.*)"$/, '$1');
    if (v) return ensureDownloadFilename(v, format);
  }

  return fallback;
}

/** Axios header objects use various casings; resolve case-insensitively. */
export function getResponseHeader(headers: unknown, name: string): string | undefined {
  if (!headers || typeof headers !== 'object') return undefined;
  const lower = name.toLowerCase();
  const rec = headers as Record<string, string>;
  const key = Object.keys(rec).find((k) => k.toLowerCase() === lower);
  const v = key ? rec[key] : undefined;
  return typeof v === 'string' ? v : undefined;
}
