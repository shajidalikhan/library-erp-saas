import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ReportsSubNav } from '@/modules/reports/components/reports-sub-nav';

export const metadata: Metadata = { title: 'Reports' };

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <ReportsSubNav />
      {children}
    </div>
  );
}
