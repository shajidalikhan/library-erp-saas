'use client';

import { usePathname } from 'next/navigation';

import { TenantWorkspaceBar } from '@/components/layout/tenant-workspace-bar';

/** Hide super-admin workspace bar on SaaS control / platform routes. */
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

export function DashboardWorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hide = shouldHideWorkspace(pathname);

  return (
    <>
      {!hide ? <TenantWorkspaceBar /> : null}
      {children}
    </>
  );
}
