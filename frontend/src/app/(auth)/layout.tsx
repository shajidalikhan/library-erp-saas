import { GuestGuard } from '@/components/auth/guest-guard';
import { AuthLayout } from '@/layouts/auth-layout';

export default function AuthSegmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <GuestGuard>
      <AuthLayout>{children}</AuthLayout>
    </GuestGuard>
  );
}
