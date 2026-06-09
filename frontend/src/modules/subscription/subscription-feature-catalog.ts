/**
 * Canonical SaaS feature catalog — keep in sync with
 * `backend/src/modules/subscription-billing/subscription-feature-catalog.ts`.
 */

export const SUBSCRIPTION_FEATURE_CATEGORIES = [
  'Core Operations',
  'Booking',
  'Finance',
  'Reports & Analytics',
  'Communication',
  'Automation',
  'Branding',
  'Enterprise',
] as const;

export type SubscriptionFeatureCategory = (typeof SUBSCRIPTION_FEATURE_CATEGORIES)[number];

export type SubscriptionFeatureDefinition = {
  key: string;
  label: string;
  description: string;
  category: SubscriptionFeatureCategory;
  defaultEnabled: boolean;
};

export const SUBSCRIPTION_FEATURE_CATALOG: SubscriptionFeatureDefinition[] = [
  { key: 'multi_branch', label: 'Multi-branch', description: 'Operate more than one branch per library.', category: 'Core Operations', defaultEnabled: false },
  { key: 'seat_management', label: 'Seat management', description: 'Seat inventory, grid, and assignments.', category: 'Core Operations', defaultEnabled: true },
  { key: 'shift_management', label: 'Shift management', description: 'Reading hall shifts and schedules.', category: 'Core Operations', defaultEnabled: true },
  { key: 'attendance', label: 'Attendance', description: 'Daily attendance check-in and tracking.', category: 'Core Operations', defaultEnabled: true },
  { key: 'qr_attendance', label: 'QR attendance', description: 'QR-based kiosk attendance flows.', category: 'Core Operations', defaultEnabled: false },
  {
    key: 'public_booking',
    label: 'Public Booking',
    description: 'Allow libraries to publish a public booking page and receive seat hold requests.',
    category: 'Booking',
    defaultEnabled: false,
  },
  { key: 'payments', label: 'Payments', description: 'Collect and record student payments.', category: 'Finance', defaultEnabled: true },
  { key: 'invoices', label: 'Invoices', description: 'Issue and manage fee invoices.', category: 'Finance', defaultEnabled: true },
  { key: 'dues', label: 'Dues tracking', description: 'Outstanding dues and follow-up lists.', category: 'Finance', defaultEnabled: true },
  { key: 'payment_reminders', label: 'Payment reminders', description: 'Automated payment reminder workflows.', category: 'Finance', defaultEnabled: false },
  { key: 'reports', label: 'Reports', description: 'Operational report previews and tables.', category: 'Reports & Analytics', defaultEnabled: true },
  { key: 'exports', label: 'Data exports', description: 'CSV/Excel/PDF exports from reports.', category: 'Reports & Analytics', defaultEnabled: false },
  { key: 'analytics', label: 'Analytics', description: 'KPI dashboards and trend analytics.', category: 'Reports & Analytics', defaultEnabled: false },
  { key: 'advanced_attendance_reports', label: 'Advanced attendance reports', description: 'Deeper attendance breakdowns.', category: 'Reports & Analytics', defaultEnabled: false },
  { key: 'membership_analytics', label: 'Membership analytics', description: 'Membership cohort and renewal analytics.', category: 'Reports & Analytics', defaultEnabled: false },
  { key: 'branch_analytics', label: 'Branch analytics', description: 'Per-branch performance comparisons.', category: 'Reports & Analytics', defaultEnabled: false },
  { key: 'notifications', label: 'Notifications', description: 'In-app and targeted library notifications.', category: 'Communication', defaultEnabled: true },
  { key: 'email_notifications', label: 'Email notifications', description: 'Transactional email delivery.', category: 'Communication', defaultEnabled: true },
  { key: 'whatsapp', label: 'WhatsApp', description: 'WhatsApp messaging integration.', category: 'Communication', defaultEnabled: false },
  { key: 'sms', label: 'SMS', description: 'SMS alerts and reminders.', category: 'Communication', defaultEnabled: false },
  { key: 'student_portal', label: 'Student portal', description: 'Self-serve student login experience.', category: 'Communication', defaultEnabled: false },
  { key: 'automation_jobs', label: 'Automation jobs', description: 'Scheduled jobs and batch automation.', category: 'Automation', defaultEnabled: false },
  { key: 'api_access', label: 'API access', description: 'External API and integration access.', category: 'Automation', defaultEnabled: false },
  { key: 'audit_logs', label: 'Audit logs', description: 'Security and activity audit trail.', category: 'Automation', defaultEnabled: false },
  { key: 'custom_roles', label: 'Custom roles', description: 'Custom RBAC role bundles.', category: 'Enterprise', defaultEnabled: false },
  { key: 'custom_branding', label: 'Custom branding', description: 'Logo and branded library experience.', category: 'Branding', defaultEnabled: false },
  { key: 'white_label', label: 'White label', description: 'Full white-label tenant experience.', category: 'Branding', defaultEnabled: false },
  { key: 'priority_support', label: 'Priority support', description: 'Priority platform support SLA.', category: 'Enterprise', defaultEnabled: false },
];

export const SUBSCRIPTION_FEATURE_KEYS = SUBSCRIPTION_FEATURE_CATALOG.map((f) => f.key);

export function catalogFeatureLabel(key: string): string {
  return SUBSCRIPTION_FEATURE_CATALOG.find((f) => f.key === key)?.label ?? key;
}
