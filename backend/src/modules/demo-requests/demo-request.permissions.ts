/**
 * Demo request permissions (platform CRM).
 * Super admins bypass permission checks; these exist for future sales roles.
 */
export const DEMO_REQUEST_PERMISSIONS = {
  READ: 'demo_request.read',
  UPDATE: 'demo_request.update',
} as const;
