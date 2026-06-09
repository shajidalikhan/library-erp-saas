import { PERMISSIONS } from '@/constants/permissions';
import { ROUTES } from '@/constants/routes';
import type { PermissionName } from '@/constants/permissions';
import type { RoleCapabilityModule } from '@/types/auth';

export type RouteCapabilityRule = {
  module: RoleCapabilityModule;
  action?: string;
  permission?: PermissionName | PermissionName[];
};

const rules: { prefix: string; rule: RouteCapabilityRule }[] = [
  { prefix: ROUTES.STUDENTS + '/new', rule: { module: 'students', action: 'create', permission: PERMISSIONS.STUDENT_CREATE } },
  { prefix: ROUTES.STUDENTS + '/create', rule: { module: 'students', action: 'create', permission: PERMISSIONS.STUDENT_CREATE } },
  { prefix: ROUTES.STUDENTS, rule: { module: 'students', action: 'view', permission: [PERMISSIONS.STUDENT_READ, PERMISSIONS.STUDENT_READ_BASIC] } },
  { prefix: ROUTES.SEATS, rule: { module: 'seats', action: 'view', permission: PERMISSIONS.SEAT_READ } },
  { prefix: ROUTES.SHIFTS, rule: { module: 'shifts', action: 'view', permission: PERMISSIONS.SHIFT_READ } },
  { prefix: ROUTES.ATTENDANCE, rule: { module: 'attendance', action: 'view', permission: PERMISSIONS.ATTENDANCE_READ } },
  { prefix: ROUTES.PAYMENTS_COLLECT, rule: { module: 'payments', action: 'collect', permission: PERMISSIONS.PAYMENT_CREATE } },
  { prefix: ROUTES.PAYMENTS, rule: { module: 'payments', action: 'view', permission: PERMISSIONS.PAYMENT_READ } },
  { prefix: ROUTES.REPORTS, rule: { module: 'reports', action: 'view', permission: PERMISSIONS.REPORT_VIEW } },
  { prefix: ROUTES.ANALYTICS, rule: { module: 'analytics', action: 'view', permission: PERMISSIONS.ANALYTICS_VIEW } },
  { prefix: ROUTES.NOTIFICATIONS_SEND, rule: { module: 'notifications', action: 'send', permission: PERMISSIONS.NOTIFICATION_SEND } },
  { prefix: ROUTES.NOTIFICATIONS, rule: { module: 'notifications', action: 'view', permission: PERMISSIONS.NOTIFICATION_READ } },
];

export function resolveRouteCapability(pathname: string): RouteCapabilityRule | null {
  const sorted = [...rules].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const { prefix, rule } of sorted) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return rule;
    }
  }
  return null;
}
