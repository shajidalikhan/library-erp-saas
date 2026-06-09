const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Strip script tags and inline event handlers from admin-edited HTML. */
export function sanitizeEmailHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\bon\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '');
}

export function renderEmailTemplate(
  template: string,
  vars: Record<string, string>,
  options?: { escapeHtmlValues?: boolean },
): string {
  const escapeValues = options?.escapeHtmlValues ?? false;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
    const raw = vars[key] ?? '';
    return escapeValues ? escapeHtml(raw) : raw;
  });
}
