import type { PublicLibraryProfile } from '@/modules/bookings/types';

export type PublicSeatStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'RESERVED'
  | 'BLOCKED'
  | 'NOT_AVAILABLE';

export function showFullSeatBreakdown(profile: Pick<PublicLibraryProfile, 'publicBookingSettings'>): boolean {
  return Boolean(profile.publicBookingSettings?.showFullSeatBreakdown);
}

export function filterPublicSummaryForDisplay(
  summary: Record<string, number>,
  showFull: boolean,
): Array<{ key: string; label: string; count: number }> {
  if (!showFull) {
    return [
      {
        key: 'AVAILABLE',
        label: 'Available seats right now',
        count: summary.AVAILABLE ?? 0,
      },
    ];
  }
  const reservedBlocked = (summary.RESERVED ?? 0) + (summary.BLOCKED ?? 0);
  return [
    { key: 'AVAILABLE', label: 'Available', count: summary.AVAILABLE ?? 0 },
    { key: 'OCCUPIED', label: 'Occupied', count: summary.OCCUPIED ?? 0 },
    {
      key: 'RESERVED_BLOCKED',
      label: 'Reserved / blocked',
      count: reservedBlocked,
    },
  ];
}

export function isPublicSeatSelectable(status: PublicSeatStatus): boolean {
  return status === 'AVAILABLE';
}

export function getPublicSeatTooltip(status: PublicSeatStatus, showFull: boolean): string {
  if (status === 'AVAILABLE') return 'Available for selected shift';
  if (!showFull || status === 'NOT_AVAILABLE') return 'Not available';
  if (status === 'OCCUPIED') return 'Occupied';
  if (status === 'RESERVED') return 'Reserved';
  return 'Blocked';
}

export function getPublicSeatCellClass(status: PublicSeatStatus, showFull: boolean, isSelected: boolean): string {
  if (status === 'AVAILABLE') {
    return isSelected
      ? 'border-primary bg-primary/15 ring-2 ring-primary/30'
      : 'border-emerald-500 bg-emerald-50 hover:scale-[1.02] dark:bg-emerald-950/30';
  }
  if (!showFull || status === 'NOT_AVAILABLE') {
    return 'cursor-not-allowed border-slate-300 bg-slate-100 opacity-80 dark:bg-slate-800';
  }
  if (status === 'OCCUPIED') {
    return 'cursor-not-allowed border-rose-300 bg-rose-50/80 opacity-90 dark:bg-rose-950/30';
  }
  if (status === 'RESERVED') {
    return 'cursor-not-allowed border-amber-300 bg-amber-50/80 dark:bg-amber-950/30';
  }
  return 'cursor-not-allowed border-slate-300 bg-slate-100 opacity-80 dark:bg-slate-800';
}

export const PUBLIC_SEAT_LEGEND_FULL = [
  { status: 'AVAILABLE', label: 'Available' },
  { status: 'OCCUPIED', label: 'Occupied' },
  { status: 'RESERVED', label: 'Reserved' },
  { status: 'BLOCKED', label: 'Blocked' },
] as const;

export const PUBLIC_SEAT_LEGEND_SIMPLE = [
  { status: 'AVAILABLE', label: 'Available' },
  { status: 'NOT_AVAILABLE', label: 'Not available' },
] as const;

export function plansForShift(
  profile: PublicLibraryProfile,
  shiftId: string,
  branchId: string,
) {
  return profile.feePlans.filter(
    (p) => p.branchId === branchId && (p.shiftId === shiftId || !p.shiftId),
  );
}

export function pickBestValuePlanId<T extends { _id: string; amount: number; durationDays: number }>(
  plans: T[],
): string | null {
  if (!plans.length) return null;
  const sorted = [...plans].sort((a, b) => a.amount / a.durationDays - b.amount / b.durationDays);
  return sorted[0]._id;
}

export function planIncludesRegistration(type: string): boolean {
  return type === 'REGISTRATION' || type === 'REGISTRATION_PLUS_MEMBERSHIP';
}
