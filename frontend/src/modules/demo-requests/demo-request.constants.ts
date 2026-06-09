export const DEMO_REQUEST_FEATURES = [
  { id: 'ATTENDANCE', label: 'Attendance' },
  { id: 'PAYMENTS', label: 'Payments' },
  { id: 'ANALYTICS', label: 'Analytics' },
  { id: 'STUDENT_PORTAL', label: 'Student portal' },
  { id: 'MULTI_BRANCH', label: 'Multi-branch' },
  { id: 'NOTIFICATIONS', label: 'Notifications' },
  { id: 'REPORTS', label: 'Reports' },
] as const;

export type DemoRequestFeatureId = (typeof DEMO_REQUEST_FEATURES)[number]['id'];

export const DEMO_REQUEST_STATUSES = [
  'NEW',
  'CONTACTED',
  'DEMO_SCHEDULED',
  'CONVERTED',
  'REJECTED',
] as const;

export type DemoRequestStatus = (typeof DEMO_REQUEST_STATUSES)[number];
