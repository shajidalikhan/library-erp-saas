import { Badge } from '@/components/ui/badge';

import type { SeatStatus } from '../types';

const STYLES: Record<SeatStatus, string> = {
  AVAILABLE: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  OCCUPIED: 'bg-amber-500/15 text-amber-800 dark:text-amber-400 border-amber-500/30',
  RESERVED: 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30',
  MAINTENANCE: 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/30',
  BLOCKED: 'bg-red-500/15 text-red-800 dark:text-red-300 border-red-500/30',
};

export function SeatStatusBadge({ status }: { status: SeatStatus }) {
  return (
    <Badge variant="outline" className={STYLES[status] ?? ''}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

export function seatStatusHex(status: SeatStatus): string {
  switch (status) {
    case 'AVAILABLE':
      return '#10b981';
    case 'OCCUPIED':
      return '#f59e0b';
    case 'RESERVED':
      return '#0ea5e9';
    case 'MAINTENANCE':
      return '#f97316';
    case 'BLOCKED':
      return '#ef4444';
    default:
      return '#94a3b8';
  }
}
