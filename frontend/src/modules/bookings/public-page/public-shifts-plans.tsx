'use client';

import type { PublicLibraryProfile } from '@/modules/bookings/types';

import { PublicShiftsSection } from './public-shifts-section';

type PublicShiftsPlansProps = {
  slug: string;
  data: PublicLibraryProfile;
  onChooseShift?: (shiftId: string, branchId: string) => void;
  compact?: boolean;
};

/** Landing page: shift cards only (plans shown after choosing a shift on the book page). */
export function PublicShiftsPlans({ slug, data, onChooseShift, compact }: PublicShiftsPlansProps) {
  return <PublicShiftsSection slug={slug} data={data} onChooseShift={onChooseShift} compact={compact} />;
}
