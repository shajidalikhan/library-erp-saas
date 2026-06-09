/**
 * Reports module — permission reference.
 *
 * Route guards are applied in `reports.routes.ts` using `authorize` /
 * `authorizeAny`. This file documents the intended mapping for seeders and audits.
 */

import { PERMISSIONS } from '@constants/permissions.constants';

export const REPORT_PERMISSIONS = {
  reportOrAnalyticsGate: [PERMISSIONS.REPORT_VIEW, PERMISSIONS.ANALYTICS_VIEW] as const,
  students: [PERMISSIONS.STUDENT_READ] as const,
  attendance: [PERMISSIONS.ATTENDANCE_READ] as const,
  seats: [PERMISSIONS.SEAT_READ, PERMISSIONS.SEAT_OCCUPANCY_READ] as const,
  finance: [PERMISSIONS.PAYMENT_READ] as const,
  branches: [PERMISSIONS.BRANCH_READ, PERMISSIONS.PAYMENT_READ] as const,
} as const;
