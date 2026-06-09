import type { StudentMembership } from './membership.service';

/** Whether the student profile should show the long-duration partial-payment card. */
export function shouldShowLongDurationSection(membership: StudentMembership | null | undefined): boolean {
  if (!membership) return false;
  if (membership.downgradeStatus === 'PENDING' || membership.downgradeStatus === 'COMPLETED') {
    return true;
  }
  if ((membership.pendingUpgradeAmount ?? 0) > 0) return true;
  if (
    (membership.selectedPlanDurationDays ?? 0) > 30 &&
    membership.allowPartialStart === true
  ) {
    return true;
  }
  return false;
}
