import type { PublicLibraryProfile } from '@/modules/bookings/types';

export type PublicPhoto = PublicLibraryProfile['library']['coverPhotos'][number];

export function resolveLibraryLogoUrl(logo: unknown): string | null {
  if (!logo) return null;
  if (typeof logo === 'string' && logo.trim()) return logo;
  if (typeof logo === 'object' && logo !== null && 'url' in logo) {
    const url = (logo as { url?: unknown }).url;
    return typeof url === 'string' && url.trim() ? url : null;
  }
  return null;
}

export function sortPublicPhotos(photos: PublicPhoto[]): PublicPhoto[] {
  return [...photos].sort((a, b) => a.order - b.order);
}

export function getCoverPhoto(photos: PublicPhoto[]): PublicPhoto | null {
  const sorted = sortPublicPhotos(photos);
  return sorted.find((p) => p.isCover) ?? sorted[0] ?? null;
}

export function formatAddress(library: PublicLibraryProfile['library']): string {
  return [library.address, library.city].filter(Boolean).join(', ');
}

export function isGoogleMapsEmbedUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.includes('google.com/maps/embed') || u.includes('output=embed');
}

export function isGoogleMapsLink(url: string): boolean {
  const u = url.trim().toLowerCase();
  return (
    u.includes('google.com/maps') ||
    u.includes('goo.gl/maps') ||
    u.includes('maps.app.goo.gl')
  );
}

export function resolveMapsOpenUrl(
  mapLocation: string | undefined,
  latitude?: number | null,
  longitude?: number | null,
): string | null {
  if (latitude != null && longitude != null && !Number.isNaN(latitude) && !Number.isNaN(longitude)) {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }
  const raw = mapLocation?.trim();
  if (!raw) return null;
  if (isGoogleMapsLink(raw)) return raw;
  const query = encodeURIComponent(raw);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function resolveMapsEmbedUrl(
  mapLocation: string | undefined,
  latitude?: number | null,
  longitude?: number | null,
): string | null {
  const raw = mapLocation?.trim();
  if (raw && isGoogleMapsEmbedUrl(raw)) return raw;
  if (latitude != null && longitude != null && !Number.isNaN(latitude) && !Number.isNaN(longitude)) {
    return `https://maps.google.com/maps?q=${latitude},${longitude}&hl=en&z=15&output=embed`;
  }
  return null;
}

export function whatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function formatShiftTime(start: string, end: string): string {
  return `${start} – ${end}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
