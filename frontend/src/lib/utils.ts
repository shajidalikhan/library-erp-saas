import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind classes safely - dedupes conflicting utilities and respects
 * conditional class objects/arrays. Used by every shadcn component.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Return the initials for an avatar fallback. */
export function getInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || 'U';
}

/** Pretty currency formatter. */
export function formatCurrency(
  value: number,
  currency?: string,
  locale = 'en-IN',
): string {
  const code = currency === 'USD' || currency === 'EUR' ? currency : 'INR';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(value);
}

/** Pretty date formatter. */
export function formatDate(input: string | Date, locale = 'en-IN'): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}
