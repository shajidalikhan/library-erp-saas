import {
  LayoutDashboard,
  Users,
  Armchair,
  ClipboardCheck,
  ClipboardList,
  Tags,
  AlertTriangle,
  CreditCard,
  BarChart3,
  FileText,
  Bell,
  Building2,
  Landmark,
  Library as LibraryIcon,
  UserCog,
  Settings,
  Shield,
  Inbox,
  Clock,
  Receipt,
  type LucideIcon,
} from 'lucide-react';

import { PERMISSIONS, ROLES, type PermissionName, type RoleName } from './permissions';
import type { RoleCapabilityModule } from '@/types/auth';
import { ROUTES, seatGridRoute } from './routes';

/**
 * Sidebar navigation definition.
 *
 * Each item declares the permissions required to see it. If the user has
 * none of the listed permissions, the item is hidden by the sidebar render
 * layer. Always declare the minimal permission needed - the layout calls
 * `hasAnyPermission()` so any one match is enough.
 */
/** Subscription catalog key — item hidden unless plan includes feature (Super Admin bypasses). */
export type SubscriptionNavFeature =
  | 'seat_management'
  | 'shift_management'
  | 'attendance'
  | 'payments'
  | 'invoices'
  | 'dues'
  | 'reports'
  | 'analytics'
  | 'notifications'
  | 'multi_branch'
  | 'public_booking';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permissions?: PermissionName[]; // undefined = visible to all authenticated users
  subscriptionFeature?: SubscriptionNavFeature;
  badge?: string;
  /**
   * When set, the item is hidden unless the user has a tenant `libraryId`, and
   * the sidebar rewrites `href` to the correct library-scoped URL.
   */
  tenantHref?: 'library' | 'branches';
  /** When set, only users with one of these roles see the item (after permission checks). */
  rolesOnly?: RoleName[];
  /** SUPER_ADMIN-configurable module gate (paired with subscription + permissions). */
  roleModule?: RoleCapabilityModule;
  /** Highlight when pathname matches this prefix (defaults to `href`). */
  activeMatchPrefix?: string;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

export const PRIMARY_NAV: NavSection[] = [
  {
    items: [
      {
        label: 'Overview',
        href: ROUTES.DASHBOARD,
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        label: 'Students',
        href: ROUTES.STUDENTS,
        icon: Users,
        permissions: [PERMISSIONS.STUDENT_READ, PERMISSIONS.STUDENT_READ_BASIC],
        roleModule: 'students',
      },
      {
        label: 'Seats',
        href: seatGridRoute(),
        activeMatchPrefix: ROUTES.SEATS,
        icon: Armchair,
        permissions: [PERMISSIONS.SEAT_READ, PERMISSIONS.SEAT_OCCUPANCY_READ],
        subscriptionFeature: 'seat_management',
        roleModule: 'seats',
      },
      {
        label: 'Shifts',
        href: ROUTES.SHIFTS,
        icon: Clock,
        permissions: [PERMISSIONS.SHIFT_READ],
        subscriptionFeature: 'shift_management',
        roleModule: 'shifts',
      },
      {
        label: 'Attendance',
        href: ROUTES.ATTENDANCE,
        icon: ClipboardCheck,
        permissions: [PERMISSIONS.ATTENDANCE_READ],
        subscriptionFeature: 'attendance',
        roleModule: 'attendance',
      },
      {
        label: 'Payments',
        href: ROUTES.PAYMENTS_COLLECT,
        icon: CreditCard,
        permissions: [PERMISSIONS.PAYMENT_CREATE],
        subscriptionFeature: 'payments',
        roleModule: 'payments',
      },
      {
        label: 'Invoices',
        href: ROUTES.PAYMENTS_INVOICES,
        icon: ClipboardList,
        permissions: [PERMISSIONS.PAYMENT_READ],
        subscriptionFeature: 'invoices',
        roleModule: 'invoices',
      },
      {
        label: 'Fee plans',
        href: ROUTES.PAYMENTS_FEE_PLANS,
        icon: Tags,
        permissions: [PERMISSIONS.FEE_PLAN_READ],
        subscriptionFeature: 'payments',
      },
      {
        label: 'Dues',
        href: ROUTES.PAYMENTS_DUES,
        icon: AlertTriangle,
        permissions: [PERMISSIONS.PAYMENT_READ],
        subscriptionFeature: 'dues',
        roleModule: 'dues',
      },
    ],
  },
  {
    label: 'Insights',
    items: [
      {
        label: 'Reports',
        href: ROUTES.REPORTS,
        icon: FileText,
        permissions: [PERMISSIONS.REPORT_VIEW, PERMISSIONS.ANALYTICS_VIEW],
        subscriptionFeature: 'reports',
        roleModule: 'reports',
      },
      {
        label: 'Analytics',
        href: ROUTES.ANALYTICS,
        icon: BarChart3,
        permissions: [PERMISSIONS.ANALYTICS_VIEW],
        subscriptionFeature: 'analytics',
        roleModule: 'analytics',
      },
      {
        label: 'Notifications',
        href: ROUTES.NOTIFICATIONS,
        icon: Bell,
        permissions: [PERMISSIONS.NOTIFICATION_READ],
        subscriptionFeature: 'notifications',
        roleModule: 'notifications',
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        label: 'Billing',
        href: ROUTES.BILLING,
        icon: CreditCard,
        rolesOnly: [ROLES.LIBRARY_OWNER],
      },
      {
        label: 'Libraries',
        href: ROUTES.LIBRARIES,
        icon: Landmark,
        permissions: [PERMISSIONS.LIBRARY_CREATE],
      },
      {
        label: 'My library',
        href: ROUTES.LIBRARIES,
        icon: LibraryIcon,
        permissions: [PERMISSIONS.LIBRARY_READ],
        tenantHref: 'library',
      },
      {
        label: 'Users',
        href: ROUTES.USERS,
        icon: UserCog,
        permissions: [PERMISSIONS.USER_READ, PERMISSIONS.STAFF_READ],
      },
      {
        label: 'Branches',
        href: ROUTES.BRANCHES,
        icon: Building2,
        permissions: [PERMISSIONS.BRANCH_READ],
        tenantHref: 'branches',
      },
      {
        label: 'Settings',
        href: ROUTES.SETTINGS,
        icon: Settings,
      },
      {
        label: 'Public Booking',
        href: ROUTES.BOOKINGS_PUBLIC_PAGE,
        icon: ClipboardList,
        permissions: [
          PERMISSIONS.PUBLIC_PAGE_MANAGE,
          PERMISSIONS.BOOKING_READ,
          PERMISSIONS.BOOKING_MANAGE,
        ],
        subscriptionFeature: 'public_booking',
        roleModule: 'public_booking',
      },
    ],
  },
  {
    label: 'Platform',
    items: [
      {
        label: 'SaaS control',
        href: ROUTES.PLATFORM,
        icon: Shield,
        permissions: [PERMISSIONS.PLATFORM_MANAGE],
      },
      {
        label: 'Subscription invoices',
        href: ROUTES.PLATFORM_SUBSCRIPTION_INVOICES,
        icon: Receipt,
        permissions: [PERMISSIONS.PLATFORM_MANAGE],
      },
      {
        label: 'Demo Requests',
        href: ROUTES.PLATFORM_DEMO_REQUESTS,
        icon: Inbox,
        permissions: [PERMISSIONS.PLATFORM_MANAGE],
      },
    ],
  },
];
