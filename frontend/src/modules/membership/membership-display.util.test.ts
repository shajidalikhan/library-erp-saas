import { describe, expect, it } from 'vitest';

import type { StudentMembership } from './membership.service';
import { shouldShowLongDurationSection } from './membership-display.util';

const base: StudentMembership = {
  _id: '1',
  studentId: 's1',
  startDate: '2026-01-01',
  endDate: '2026-02-01',
  durationDays: 30,
  status: 'ACTIVE',
};

describe('shouldShowLongDurationSection', () => {
  it('hides for normal monthly membership', () => {
    expect(shouldShowLongDurationSection({ ...base, downgradeStatus: 'NONE' })).toBe(false);
  });

  it('shows for pending downgrade', () => {
    expect(shouldShowLongDurationSection({ ...base, downgradeStatus: 'PENDING' })).toBe(true);
  });

  it('shows for completed downgrade', () => {
    expect(shouldShowLongDurationSection({ ...base, downgradeStatus: 'COMPLETED' })).toBe(true);
  });

  it('shows for long partial plan', () => {
    expect(
      shouldShowLongDurationSection({
        ...base,
        selectedPlanDurationDays: 180,
        allowPartialStart: true,
      }),
    ).toBe(true);
  });
});
