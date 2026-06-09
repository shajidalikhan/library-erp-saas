import { request } from '@/lib/axios';
import type { DowngradeStatus } from '@/modules/payments/types';

export type StudentMembership = {
  _id: string;
  studentId: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  status: string;
  selectedPlanDurationDays?: number | null;
  effectiveDurationDays?: number | null;
  originalEndDate?: string | null;
  effectiveEndDate?: string | null;
  downgradeDueDate?: string | null;
  downgradeStatus?: DowngradeStatus;
  downgradeReason?: string | null;
  fullPaymentRequiredAmount?: number | null;
  pendingUpgradeAmount?: number | null;
  allowPartialStart?: boolean;
  feePlanOfferLabel?: string | null;
  linkedInvoice?: {
    invoiceId: string;
    invoiceNumber: string;
    dueAmount: number;
    dueDate: string;
    status: string;
  };
};

export type MembershipDashboardStats = {
  expired: number;
  expiring1to3: number;
  expiring4to7: number;
  expiredToday: number;
  active: number;
};

export const membershipApi = {
  dashboard: (params?: { libraryId?: string; branchId?: string }) =>
    request<MembershipDashboardStats>({ url: '/memberships/dashboard', method: 'GET', params }),

  listForStudent: (studentId: string) =>
    request<{ items: StudentMembership[] }>({
      url: `/memberships/student/${studentId}`,
      method: 'GET',
    }).then((r) => r.items),

  renew: (studentId: string, body: { feePlanId: string; durationDays?: number; membershipType?: string }) =>
    request<{ membership: unknown }>({
      url: `/memberships/student/${studentId}/renew`,
      method: 'POST',
      data: body,
    }).then((r) => r.membership),
};
