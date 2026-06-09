import { ROLES, type RoleName } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';

import {
  ROLE_CAPABILITY_MODULES,
  type RoleCapabilityModule,
} from './role-capabilities.constants';

export const MODULE_ACTIONS = {
  students: ['view', 'create', 'edit', 'delete', 'export', 'transfer', 'assign_seat'] as const,
  attendance: ['view', 'checkin', 'checkout', 'export'] as const,
  seats: ['view', 'create', 'edit', 'delete', 'assign', 'bulk_create'] as const,
  shifts: ['view', 'create', 'edit', 'delete'] as const,
  payments: ['view', 'collect', 'refund', 'export'] as const,
  invoices: ['view', 'create', 'export'] as const,
  dues: ['view', 'export'] as const,
  reports: ['view', 'export'] as const,
  analytics: ['view'] as const,
  notifications: ['view', 'send', 'broadcast', 'template_manage'] as const,
  settings: ['view', 'edit'] as const,
  public_booking: ['view', 'manage', 'approve', 'convert'] as const,
} as const satisfies Record<RoleCapabilityModule, readonly string[]>;

export type ModuleAction<M extends RoleCapabilityModule> =
  (typeof MODULE_ACTIONS)[M][number];

export type RoleCapabilityActionMatrix = {
  [R in RoleName]: {
    [M in RoleCapabilityModule]: Record<ModuleAction<M>, boolean>;
  };
};

export const MODULE_SUBSCRIPTION_FEATURE: Partial<
  Record<RoleCapabilityModule, string>
> = {
  seats: 'seat_management',
  shifts: 'shift_management',
  attendance: 'attendance',
  payments: 'payments',
  invoices: 'invoices',
  dues: 'dues',
  reports: 'reports',
  analytics: 'analytics',
  notifications: 'notifications',
  public_booking: 'public_booking',
};

/** Maps RBAC permission strings to capability module + action. */
export const PERMISSION_CAPABILITY_MAP: Record<
  string,
  { module: RoleCapabilityModule; action: string }
> = {
  [PERMISSIONS.STUDENT_READ]: { module: 'students', action: 'view' },
  [PERMISSIONS.STUDENT_READ_BASIC]: { module: 'students', action: 'view' },
  [PERMISSIONS.STUDENT_CREATE]: { module: 'students', action: 'create' },
  [PERMISSIONS.STUDENT_UPDATE]: { module: 'students', action: 'edit' },
  [PERMISSIONS.STUDENT_DELETE]: { module: 'students', action: 'delete' },
  [PERMISSIONS.STUDENT_TRANSFER]: { module: 'students', action: 'transfer' },
  [PERMISSIONS.STUDENT_ASSIGN_SEAT]: { module: 'students', action: 'assign_seat' },
  [PERMISSIONS.ATTENDANCE_READ]: { module: 'attendance', action: 'view' },
  [PERMISSIONS.ATTENDANCE_CREATE]: { module: 'attendance', action: 'checkin' },
  [PERMISSIONS.ATTENDANCE_CHECK_IN]: { module: 'attendance', action: 'checkin' },
  [PERMISSIONS.ATTENDANCE_CHECK_OUT]: { module: 'attendance', action: 'checkout' },
  [PERMISSIONS.ATTENDANCE_UPDATE]: { module: 'attendance', action: 'checkout' },
  [PERMISSIONS.SEAT_READ]: { module: 'seats', action: 'view' },
  [PERMISSIONS.SEAT_OCCUPANCY_READ]: { module: 'seats', action: 'view' },
  [PERMISSIONS.SEAT_CREATE]: { module: 'seats', action: 'create' },
  [PERMISSIONS.SEAT_UPDATE]: { module: 'seats', action: 'edit' },
  [PERMISSIONS.SEAT_DELETE]: { module: 'seats', action: 'delete' },
  [PERMISSIONS.SEAT_ASSIGN]: { module: 'seats', action: 'assign' },
  [PERMISSIONS.SEAT_BULK_CREATE]: { module: 'seats', action: 'bulk_create' },
  [PERMISSIONS.SHIFT_READ]: { module: 'shifts', action: 'view' },
  [PERMISSIONS.SHIFT_CREATE]: { module: 'shifts', action: 'create' },
  [PERMISSIONS.SHIFT_UPDATE]: { module: 'shifts', action: 'edit' },
  [PERMISSIONS.SHIFT_DELETE]: { module: 'shifts', action: 'delete' },
  [PERMISSIONS.PAYMENT_READ]: { module: 'payments', action: 'view' },
  [PERMISSIONS.PAYMENT_CREATE]: { module: 'payments', action: 'collect' },
  [PERMISSIONS.PAYMENT_REFUND]: { module: 'payments', action: 'refund' },
  [PERMISSIONS.FEE_PLAN_READ]: { module: 'invoices', action: 'view' },
  [PERMISSIONS.REPORT_VIEW]: { module: 'reports', action: 'view' },
  [PERMISSIONS.ANALYTICS_VIEW]: { module: 'analytics', action: 'view' },
  [PERMISSIONS.NOTIFICATION_READ]: { module: 'notifications', action: 'view' },
  [PERMISSIONS.NOTIFICATION_SEND]: { module: 'notifications', action: 'send' },
  [PERMISSIONS.NOTIFICATION_MANAGE]: { module: 'notifications', action: 'broadcast' },
  [PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE]: {
    module: 'notifications',
    action: 'template_manage',
  },
  [PERMISSIONS.LIBRARY_READ]: { module: 'settings', action: 'view' },
  [PERMISSIONS.LIBRARY_UPDATE]: { module: 'settings', action: 'edit' },
  [PERMISSIONS.BRANCH_READ]: { module: 'settings', action: 'view' },
  [PERMISSIONS.BOOKING_READ]: { module: 'public_booking', action: 'view' },
  [PERMISSIONS.BOOKING_CREATE]: { module: 'public_booking', action: 'manage' },
  [PERMISSIONS.BOOKING_UPDATE]: { module: 'public_booking', action: 'approve' },
  [PERMISSIONS.BOOKING_MANAGE]: { module: 'public_booking', action: 'manage' },
  [PERMISSIONS.BOOKING_CONVERT]: { module: 'public_booking', action: 'convert' },
  [PERMISSIONS.PUBLIC_PAGE_READ]: { module: 'public_booking', action: 'view' },
  [PERMISSIONS.PUBLIC_PAGE_MANAGE]: { module: 'public_booking', action: 'manage' },
};

const allActionsOn = <M extends RoleCapabilityModule>(module: M): Record<ModuleAction<M>, boolean> =>
  Object.fromEntries(MODULE_ACTIONS[module].map((a) => [a, true])) as Record<
    ModuleAction<M>,
    boolean
  >;

const allActionsOff = <M extends RoleCapabilityModule>(module: M): Record<ModuleAction<M>, boolean> =>
  Object.fromEntries(MODULE_ACTIONS[module].map((a) => [a, false])) as Record<
    ModuleAction<M>,
    boolean
  >;

const buildRoleActions = (
  enabledModules: Partial<Record<RoleCapabilityModule, boolean>>,
  actionOverrides?: Partial<
    Record<RoleCapabilityModule, Partial<Record<string, boolean>>>
  >,
): RoleCapabilityActionMatrix[RoleName] => {
  const row = {} as RoleCapabilityActionMatrix[RoleName];
  for (const mod of ROLE_CAPABILITY_MODULES) {
    const moduleOn = Boolean(enabledModules[mod]);
    const base = moduleOn ? allActionsOn(mod) : allActionsOff(mod);
    const patch = actionOverrides?.[mod];
    if (patch) {
      for (const [action, val] of Object.entries(patch)) {
        if (val !== undefined && action in base) {
          (base as Record<string, boolean>)[action] = val;
        }
      }
    }
    row[mod] = base;
  }
  return row;
};

/** Default action matrix derived from module defaults + sensible action subsets. */
export const DEFAULT_ROLE_CAPABILITY_ACTION_MATRIX: RoleCapabilityActionMatrix = {
  [ROLES.SUPER_ADMIN]: buildRoleActions(
    Object.fromEntries(ROLE_CAPABILITY_MODULES.map((m) => [m, true])) as Record<
      RoleCapabilityModule,
      boolean
    >,
  ),
  [ROLES.LIBRARY_OWNER]: buildRoleActions(
    Object.fromEntries(ROLE_CAPABILITY_MODULES.map((m) => [m, true])) as Record<
      RoleCapabilityModule,
      boolean
    >,
  ),
  [ROLES.MANAGER]: buildRoleActions(
    {
      students: true,
      attendance: true,
      seats: true,
      shifts: true,
      payments: true,
      reports: true,
      analytics: true,
      notifications: true,
      settings: true,
      public_booking: true,
    },
    {
      students: { delete: false, export: true },
      seats: { delete: false },
      shifts: { delete: false },
      payments: { collect: false, refund: false },
      analytics: { view: true },
      public_booking: { manage: false, convert: false },
    },
  ),
  [ROLES.RECEPTIONIST]: buildRoleActions(
    {
      students: true,
      attendance: true,
      seats: true,
      payments: true,
      invoices: true,
      notifications: true,
      public_booking: true,
    },
    {
      students: { delete: false, transfer: false, export: false },
      seats: { create: false, edit: false, delete: false, bulk_create: false },
      payments: { refund: false, export: false },
      public_booking: { manage: false, convert: false },
    },
  ),
  [ROLES.ACCOUNTANT]: buildRoleActions(
    {
      payments: true,
      invoices: true,
      dues: true,
      reports: true,
    },
    {
      payments: { refund: true },
    },
  ),
  [ROLES.SECURITY]: buildRoleActions(
    { attendance: true, students: true },
    {
      attendance: { export: false },
      students: {
        create: false,
        edit: false,
        delete: false,
        export: false,
        transfer: false,
        assign_seat: false,
      },
    },
  ),
  [ROLES.STUDENT]: buildRoleActions(
    {
      students: true,
      attendance: true,
      payments: true,
      notifications: true,
    },
    {
      students: { create: false, edit: false, delete: false, export: false },
      attendance: { checkin: false, checkout: false, export: false },
      payments: { collect: false, refund: false, export: false },
      notifications: { send: false, broadcast: false, template_manage: false },
    },
  ),
};

export const deriveModuleFlagsFromActions = (
  actions: RoleCapabilityActionMatrix[RoleName],
): Record<RoleCapabilityModule, boolean> =>
  Object.fromEntries(
    ROLE_CAPABILITY_MODULES.map((mod) => [
      mod,
      Object.values(actions[mod]).some(Boolean),
    ]),
  ) as Record<RoleCapabilityModule, boolean>;
