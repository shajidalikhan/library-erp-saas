/**
 * Centralized route registry. Use these constants everywhere instead of
 * hard-coded path strings - it keeps refactors painless and prevents typos.
 */
export const ROUTES = {
  // Public / auth
  ROOT: '/',
  LOGIN: '/login',
  /** Legacy path; redirects to login or dashboard. */
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  REQUEST_DEMO: '/request-demo',

  // App
  DASHBOARD: '/dashboard',
  STUDENTS: '/dashboard/students',
  SEATS: '/dashboard/seats',
  SHIFTS: '/dashboard/shifts',
  ATTENDANCE: '/dashboard/attendance',
  PAYMENTS: '/dashboard/payments',
  BOOKINGS: '/dashboard/bookings',
  BOOKINGS_PUBLIC_PAGE: '/dashboard/public-booking',
  PUBLIC_BOOKING_LIST: '/dashboard/public-booking/bookings',
  PAYMENTS_FEE_PLANS: '/dashboard/payments/fee-plans',
  PAYMENTS_FEE_PLANS_NEW: '/dashboard/payments/fee-plans/new',
  PAYMENTS_INVOICES: '/dashboard/payments/invoices',
  PAYMENTS_INVOICES_NEW: '/dashboard/payments/invoices/new',
  PAYMENTS_COLLECT: '/dashboard/payments/collect',
  PAYMENTS_DUES: '/dashboard/payments/dues',
  PAYMENTS_OVERDUE: '/dashboard/payments/overdue',
  PAYMENTS_STUDENT_HISTORY: '/dashboard/payments/students',
  REPORTS: '/dashboard/reports',
  REPORTS_STUDENTS: '/dashboard/reports/students',
  REPORTS_ATTENDANCE: '/dashboard/reports/attendance',
  REPORTS_PAYMENTS: '/dashboard/reports/payments',
  REPORTS_INVOICES: '/dashboard/reports/invoices',
  REPORTS_SEATS: '/dashboard/reports/seats',
  REPORTS_DUES: '/dashboard/reports/dues',
  REPORTS_COLLECTIONS: '/dashboard/reports/collections',
  REPORTS_BRANCHES: '/dashboard/reports/branches',
  ANALYTICS: '/dashboard/analytics',
  ANALYTICS_REVENUE: '/dashboard/analytics/revenue',
  ANALYTICS_STUDENTS: '/dashboard/analytics/students',
  ANALYTICS_SEATS: '/dashboard/analytics/seats',
  ANALYTICS_ATTENDANCE: '/dashboard/analytics/attendance',
  ANALYTICS_BRANCHES: '/dashboard/analytics/branches',
  ANALYTICS_PAYMENTS: '/dashboard/analytics/payments',
  NOTIFICATIONS: '/dashboard/notifications',
  NOTIFICATIONS_SEND: '/dashboard/notifications/send',
  NOTIFICATIONS_TEMPLATES: '/dashboard/notifications/templates',
  NOTIFICATIONS_LOGS: '/dashboard/notifications/logs',
  PLATFORM: '/dashboard/platform',
  PLATFORM_TENANTS: '/dashboard/platform/tenants',
  PLATFORM_PLANS: '/dashboard/platform/subscriptions/plans',
  PLATFORM_USAGE: '/dashboard/platform/usage',
  PLATFORM_AUDIT: '/dashboard/platform/audit-logs',
  PLATFORM_SETTINGS: '/dashboard/platform/settings',
  PLATFORM_ANNOUNCEMENTS: '/dashboard/platform/announcements',
  PLATFORM_DEMO_REQUESTS: '/dashboard/platform/demo-requests',
  PLATFORM_ROLE_CAPABILITIES: '/dashboard/platform/role-capabilities',
  PLATFORM_SUBSCRIPTION_INVOICES: '/dashboard/platform/subscriptions/invoices',
  STAFF: '/dashboard/staff',
  USERS: '/dashboard/users',
  /** Legacy entry; prefer {@link libraryBranchesRoute}. */
  BRANCHES: '/dashboard/branches',
  LIBRARIES: '/dashboard/libraries',
  SETTINGS: '/dashboard/settings',
  SETTINGS_PUBLIC_PAGE: '/dashboard/settings/public-page',
  BILLING: '/dashboard/billing',
  PROFILE: '/dashboard/profile',
  STUDENT_PORTAL: '/dashboard/student',
  MY_PROFILE: '/dashboard/my-profile',
  MY_ATTENDANCE: '/dashboard/student/attendance',
  MY_PAYMENTS: '/dashboard/student/payments',
  MY_SEAT: '/dashboard/student/seat',
} as const;

export const PAYMENTS_FEE_PLANS = ROUTES.PAYMENTS_FEE_PLANS;
export const PAYMENTS_FEE_PLANS_NEW = ROUTES.PAYMENTS_FEE_PLANS_NEW;
export const PAYMENTS_INVOICES = ROUTES.PAYMENTS_INVOICES;
export const PAYMENTS_INVOICES_NEW = ROUTES.PAYMENTS_INVOICES_NEW;
export const PAYMENTS_COLLECT = ROUTES.PAYMENTS_COLLECT;
export const PAYMENTS_DUES = ROUTES.PAYMENTS_DUES;
export const PAYMENTS_OVERDUE = ROUTES.PAYMENTS_OVERDUE;
export const PAYMENTS_STUDENT_HISTORY = ROUTES.PAYMENTS_STUDENT_HISTORY;
export const BOOKINGS = ROUTES.BOOKINGS;
export const BOOKINGS_PUBLIC_PAGE = ROUTES.BOOKINGS_PUBLIC_PAGE;
export const PUBLIC_BOOKING_LIST = ROUTES.PUBLIC_BOOKING_LIST;
export const SETTINGS_PUBLIC_PAGE = ROUTES.SETTINGS_PUBLIC_PAGE;

export const libraryDetailRoute = (libraryId: string) => `${ROUTES.LIBRARIES}/${libraryId}`;

export const libraryEditRoute = (libraryId: string) => `${ROUTES.LIBRARIES}/${libraryId}/edit`;

export const libraryBranchesRoute = (libraryId: string) =>
  `${ROUTES.LIBRARIES}/${libraryId}/branches`;

export const libraryBranchNewRoute = (libraryId: string) =>
  `${ROUTES.LIBRARIES}/${libraryId}/branches/new`;

export const libraryBranchDetailRoute = (libraryId: string, branchId: string) =>
  `${ROUTES.LIBRARIES}/${libraryId}/branches/${branchId}`;

export const libraryBranchEditRoute = (libraryId: string, branchId: string) =>
  `${ROUTES.LIBRARIES}/${libraryId}/branches/${branchId}/edit`;

export const studentNewRoute = () => `${ROUTES.STUDENTS}/create`;

export const userNewRoute = () => `${ROUTES.USERS}/create`;

export const userDetailRoute = (userId: string) => `${ROUTES.USERS}/${userId}`;

export const userEditRoute = (userId: string) => `${ROUTES.USERS}/${userId}/edit`;

export const studentDetailRoute = (studentId: string) => `${ROUTES.STUDENTS}/${studentId}`;

export const studentEditRoute = (studentId: string) => `${ROUTES.STUDENTS}/${studentId}/edit`;

export const studentSummaryRoute = (studentId: string) => `${ROUTES.STUDENTS}/${studentId}/summary`;

export const seatNewRoute = () => `${ROUTES.SEATS}/new`;
export const seatBulkRoute = () => `${ROUTES.SEATS}/bulk`;
export const seatOccupancyRoute = () => `${ROUTES.SEATS}/occupancy`;
export const seatGridRoute = () => `${ROUTES.SEATS}/grid`;

export const branchShiftsRoute = (libraryId: string, branchId: string) =>
  `${ROUTES.LIBRARIES}/${libraryId}/branches/${branchId}/shifts`;
export const seatDetailRoute = (seatId: string) => `${ROUTES.SEATS}/${seatId}`;
export const seatEditRoute = (seatId: string) => `${ROUTES.SEATS}/${seatId}/edit`;
export const seatAssignRoute = (seatId: string) => `${ROUTES.SEATS}/${seatId}/assign`;

export const attendanceDashboardRoute = () => ROUTES.ATTENDANCE;
export const attendanceDailyRoute = () => `${ROUTES.ATTENDANCE}/daily`;
export const attendanceCheckInRoute = () => `${ROUTES.ATTENDANCE}/check-in`;
export const attendanceActiveRoute = () => `${ROUTES.ATTENDANCE}/active`;
export const attendanceSummaryRoute = () => `${ROUTES.ATTENDANCE}/summary`;
export const attendanceStudentHistoryRoute = (studentId: string) =>
  `${ROUTES.ATTENDANCE}/students/${studentId}`;

export const notificationDetailRoute = (notificationId: string) =>
  `${ROUTES.NOTIFICATIONS}/${notificationId}`;

export const notificationLogDetailRoute = (logId: string) => `${ROUTES.NOTIFICATIONS_LOGS}/${logId}`;

export const platformTenantRoute = (libraryId: string) => `${ROUTES.PLATFORM_TENANTS}/${libraryId}`;

export const platformDemoRequestRoute = (requestId: string) =>
  `${ROUTES.PLATFORM_DEMO_REQUESTS}/${requestId}`;

export const paymentInvoiceRoute = (invoiceId: string) => `${ROUTES.PAYMENTS_INVOICES}/${invoiceId}`;
export const paymentReceiptRoute = (paymentId: string) => `${ROUTES.PAYMENTS}/receipts/${paymentId}`;
export const paymentCollectRoute = (invoiceId?: string) =>
  invoiceId ? `${ROUTES.PAYMENTS_COLLECT}?invoiceId=${encodeURIComponent(invoiceId)}` : ROUTES.PAYMENTS_COLLECT;
export const paymentCollectStudentRoute = (studentId: string) =>
  `${ROUTES.PAYMENTS_COLLECT}?studentId=${encodeURIComponent(studentId)}`;
export const paymentStudentHistoryRoute = (studentId: string) =>
  `${ROUTES.PAYMENTS_STUDENT_HISTORY}/${studentId}/history`;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * Guest-only routes - authenticated users get redirected to the dashboard.
 */
export const GUEST_ONLY_ROUTES: ReadonlyArray<string> = [
  ROUTES.LOGIN,
  ROUTES.FORGOT_PASSWORD,
  ROUTES.RESET_PASSWORD,
  ROUTES.REQUEST_DEMO,
];

/** Shown when a tenant library is suspended (may still have auth cookies). */
export const TENANT_SUSPENDED_ROUTE = '/tenant-suspended' as const;

/**
 * Public routes that do not require authentication.
 */
export const PUBLIC_ROUTES: ReadonlyArray<string> = [
  ROUTES.ROOT,
  ROUTES.REGISTER,
  TENANT_SUSPENDED_ROUTE,
  ...GUEST_ONLY_ROUTES,
];
