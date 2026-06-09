export const DEMO_REQUEST_STATUS = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  DEMO_SCHEDULED: 'DEMO_SCHEDULED',
  CONVERTED: 'CONVERTED',
  REJECTED: 'REJECTED',
} as const;

export type DemoRequestStatus = (typeof DEMO_REQUEST_STATUS)[keyof typeof DEMO_REQUEST_STATUS];

export const DEMO_REQUEST_STATUSES = Object.values(DEMO_REQUEST_STATUS);

export const DEMO_REQUEST_FEATURES = [
  'ATTENDANCE',
  'PAYMENTS',
  'ANALYTICS',
  'STUDENT_PORTAL',
  'MULTI_BRANCH',
  'NOTIFICATIONS',
  'REPORTS',
] as const;

export type DemoRequestFeature = (typeof DEMO_REQUEST_FEATURES)[number];
