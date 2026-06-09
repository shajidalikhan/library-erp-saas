import { ROLES, type RoleName } from '@constants/roles.constants';

/** Module keys controlled by SUPER_ADMIN role capability matrix. */
export const ROLE_CAPABILITY_MODULES = [
  'students',
  'attendance',
  'seats',
  'shifts',
  'payments',
  'invoices',
  'dues',
  'reports',
  'analytics',
  'notifications',
  'settings',
  'public_booking',
] as const;

export type RoleCapabilityModule = (typeof ROLE_CAPABILITY_MODULES)[number];

export type RoleCapabilityMatrix = Record<RoleName, Record<RoleCapabilityModule, boolean>>;

const staffRoles: RoleName[] = [
  ROLES.MANAGER,
  ROLES.RECEPTIONIST,
  ROLES.ACCOUNTANT,
  ROLES.SECURITY,
];

const allOn = (): Record<RoleCapabilityModule, boolean> =>
  Object.fromEntries(ROLE_CAPABILITY_MODULES.map((m) => [m, true])) as Record<
    RoleCapabilityModule,
    boolean
  >;

const pick = (
  modules: Partial<Record<RoleCapabilityModule, boolean>>,
): Record<RoleCapabilityModule, boolean> => {
  const base = Object.fromEntries(ROLE_CAPABILITY_MODULES.map((m) => [m, false])) as Record<
    RoleCapabilityModule,
    boolean
  >;
  for (const [k, v] of Object.entries(modules)) {
    if (v !== undefined) base[k as RoleCapabilityModule] = v;
  }
  return base;
};

/** Default capability matrix — SUPER_ADMIN may override per role via platform settings. */
export const DEFAULT_ROLE_CAPABILITY_MATRIX: RoleCapabilityMatrix = {
  [ROLES.SUPER_ADMIN]: allOn(),
  [ROLES.LIBRARY_OWNER]: allOn(),
  [ROLES.MANAGER]: pick({
    students: true,
    attendance: true,
    seats: true,
    shifts: true,
    reports: true,
    notifications: true,
    settings: true,
    public_booking: true,
  }),
  [ROLES.RECEPTIONIST]: pick({
    students: true,
    attendance: true,
    payments: true,
    notifications: true,
    public_booking: true,
  }),
  [ROLES.ACCOUNTANT]: pick({
    payments: true,
    invoices: true,
    dues: true,
    reports: true,
  }),
  [ROLES.SECURITY]: pick({
    attendance: true,
  }),
  [ROLES.STUDENT]: pick({
    students: true,
    attendance: true,
    payments: true,
    notifications: true,
  }),
};

export const CONFIGURABLE_STAFF_ROLES: RoleName[] = staffRoles;

/** Maps nav/API areas to capability module keys. */
export const PERMISSION_MODULE_MAP: Partial<Record<string, RoleCapabilityModule>> = {
  'student.read': 'students',
  'student.read.basic': 'students',
  'student.create': 'students',
  'student.update': 'students',
  'student.delete': 'students',
  'attendance.read': 'attendance',
  'attendance.create': 'attendance',
  'attendance.update': 'attendance',
  'seat.read': 'seats',
  'seat.create': 'seats',
  'seat.update': 'seats',
  'seat.delete': 'seats',
  'shift.read': 'shifts',
  'payment.read': 'payments',
  'invoice.read': 'invoices',
  'report.read': 'reports',
  'analytics.read': 'analytics',
  'notification.read': 'notifications',
  'notification.send': 'notifications',
  'library.update': 'settings',
  'branch.read': 'settings',
};
