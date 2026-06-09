'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { PageHeader } from '@/components/common/page-header';
import { SettingsSidebar } from '@/modules/settings/components/settings-sidebar';
import { getSettingsNavForRole } from '@/modules/settings/settings-nav';
import { useAuthStore, selectUser } from '@/store/auth.store';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(selectUser);
  const pathname = usePathname();
  const router = useRouter();
  const allowed = getSettingsNavForRole(user?.role);

  useEffect(() => {
    if (!user?.role || allowed.length === 0) return;
    const match = allowed.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
    if (!match && allowed[0]) {
      router.replace(allowed[0].href);
    }
  }, [pathname, user?.role, allowed, router]);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account, security, and preferences." />
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <aside className="lg:w-52 lg:shrink-0">
          <SettingsSidebar role={user?.role} />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
