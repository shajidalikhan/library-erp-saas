import type { Metadata } from 'next';
import { DashboardOverview } from './dashboard-overview';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardHomePage() {
  return <DashboardOverview />;
}
