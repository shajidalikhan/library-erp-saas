import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { NotificationsSubNav } from '@/modules/notifications/components/notifications-sub-nav';

export const metadata: Metadata = { title: 'Notifications' };

export default function NotificationsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <NotificationsSubNav />
      {children}
    </div>
  );
}
