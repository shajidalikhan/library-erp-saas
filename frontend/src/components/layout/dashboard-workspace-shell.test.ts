import { describe, expect, it } from 'vitest';

/** Mirror hide rules from dashboard-workspace-shell.tsx */
function shouldHideWorkspace(pathname: string): boolean {
  if (!pathname.startsWith('/dashboard')) return true;
  if (pathname.startsWith('/dashboard/platform')) return true;
  if (pathname === '/dashboard/billing') return true;
  if (pathname.startsWith('/dashboard/payments/invoices')) return true;
  if (pathname.startsWith('/dashboard/payments/fee-plans')) return true;
  if (pathname.startsWith('/dashboard/notifications')) return true;
  if (pathname.startsWith('/dashboard/settings')) return true;
  return false;
}

describe('shouldHideWorkspace', () => {
  it('hides on platform SaaS and settings routes', () => {
    expect(shouldHideWorkspace('/dashboard/platform/tenants')).toBe(true);
    expect(shouldHideWorkspace('/dashboard/platform/settings')).toBe(true);
    expect(shouldHideWorkspace('/dashboard/billing')).toBe(true);
    expect(shouldHideWorkspace('/dashboard/payments/invoices')).toBe(true);
    expect(shouldHideWorkspace('/dashboard/notifications/send')).toBe(true);
    expect(shouldHideWorkspace('/dashboard/settings/profile')).toBe(true);
  });

  it('shows on operational dashboard routes', () => {
    expect(shouldHideWorkspace('/dashboard')).toBe(false);
    expect(shouldHideWorkspace('/dashboard/students')).toBe(false);
    expect(shouldHideWorkspace('/dashboard/analytics/attendance')).toBe(false);
  });
});
