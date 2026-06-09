import { RouteGuard } from '@/components/auth/route-guard';
import { DashboardLayout } from '@/layouts/dashboard-layout';

export default function DashboardSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard>
      <DashboardLayout>{children}</DashboardLayout>
    </RouteGuard>
  );
}
