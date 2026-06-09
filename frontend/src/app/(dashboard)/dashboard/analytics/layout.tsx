import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AnalyticsSubNav } from '@/modules/analytics/components/analytics-sub-nav';

export const metadata: Metadata = { title: 'Analytics' };

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <AnalyticsSubNav />
      {children}
    </div>
  );
}
