import { Badge } from '@/components/ui/badge';

import type { AttendanceStatus } from '../types';

const STATUS_STYLE: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
  LATE: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  ABSENT: 'bg-slate-500/15 text-slate-700 border-slate-500/30',
  EARLY_EXIT: 'bg-orange-500/15 text-orange-700 border-orange-500/30',
  CHECKED_IN: 'bg-blue-500/15 text-blue-700 border-blue-500/30',
  CHECKED_OUT: 'bg-green-500/15 text-green-700 border-green-500/30',
};

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <Badge variant="outline" className={STATUS_STYLE[status]}>
      {status.replace('_', ' ')}
    </Badge>
  );
}
