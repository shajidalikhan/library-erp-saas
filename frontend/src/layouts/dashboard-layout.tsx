import { Sidebar } from '@/components/layout/sidebar';
import { TopNavbar } from '@/components/layout/top-navbar';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { DashboardWorkspaceShell } from '@/components/layout/dashboard-workspace-shell';
import { CapabilityRouteGuard } from '@/components/capability/capability-route-guard';

/**
 * Composite layout for every authenticated page.
 * Pairs with `<RouteGuard />` (set on the `(dashboard)/layout.tsx` segment).
 */
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavbar />
        <main className="flex-1">
          {/* Mobile breadcrumbs (the desktop variant lives inside the navbar) */}
          <div className="px-4 pt-4 sm:px-6 lg:hidden">
            <Breadcrumbs />
          </div>
          <div className="container max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
            <DashboardWorkspaceShell>
              <CapabilityRouteGuard>{children}</CapabilityRouteGuard>
            </DashboardWorkspaceShell>
          </div>
        </main>
      </div>
    </div>
  );
}
