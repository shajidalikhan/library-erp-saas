import { RouteGuard } from '@/components/auth/route-guard';
import { ROLES } from '@/constants/permissions';
import { PlatformSubNav } from '@/modules/platform/components/platform-sub-nav';

export default function PlatformSegmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard roles={[ROLES.SUPER_ADMIN]}>
      <div className="space-y-6">
        <PlatformSubNav />
        {children}
      </div>
    </RouteGuard>
  );
}
