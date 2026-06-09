export type UsageStatus = 'NORMAL' | 'WARNING' | 'OVER_LIMIT';

export type UsageMetric = {
  used: number;
  limit: number | null;
  remaining: number | null;
  status: UsageStatus;
  unlimited: boolean;
};

export type SubscriptionUsageSnapshot = {
  seats: UsageMetric;
  branches: UsageMetric;
  staff: UsageMetric;
  students: UsageMetric;
  storage?: UsageMetric;
  usageStatus?: UsageStatus;
  seatCapacity?: number;
  seatsUsed?: number;
  branchLimit?: number;
  branchesUsed?: number;
  staffLimit?: number;
  staffUsed?: number;
  studentProfiles?: number;
  studentProfileLimit?: number;
};

export type PlanLimitEntity = 'branches' | 'seats' | 'staff' | 'students';
