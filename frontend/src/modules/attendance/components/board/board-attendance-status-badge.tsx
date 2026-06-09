'use client';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { BoardAttendanceStatus, BoardGridState } from '../../types-board';

const STUDENT_STYLE: Record<BoardAttendanceStatus, string> = {
  CHECKED_IN: 'bg-emerald-500/15 text-emerald-800 border-emerald-500/40 dark:text-emerald-200',
  CHECKED_OUT: 'bg-slate-500/15 text-slate-700 border-slate-500/40 dark:text-slate-300',
  CHECKED_OUT_AUTO: 'bg-violet-500/15 text-violet-800 border-violet-500/40 dark:text-violet-200',
  NOT_CHECKED_IN: 'bg-amber-500/15 text-amber-800 border-amber-500/40 dark:text-amber-200',
  LATE: 'bg-orange-500/15 text-orange-800 border-orange-500/40 dark:text-orange-200',
};

const STATUS_LABEL: Record<BoardAttendanceStatus, string> = {
  CHECKED_IN: 'Checked in',
  CHECKED_OUT: 'Checked out',
  CHECKED_OUT_AUTO: 'Auto checked out',
  NOT_CHECKED_IN: 'Not checked in',
  LATE: 'Late',
};

export function BoardAttendanceStatusBadge({ status }: { status: BoardAttendanceStatus }) {
  const badge = (
    <Badge variant="outline" className={cn('font-medium', STUDENT_STYLE[status])}>
      {STATUS_LABEL[status]}
    </Badge>
  );

  if (status !== 'CHECKED_OUT_AUTO') return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>Auto checked out by system</TooltipContent>
    </Tooltip>
  );
}

const GRID_STYLE: Record<BoardGridState, string> = {
  VACANT: 'bg-emerald-950/20 border-emerald-900/30 text-muted-foreground',
  ASSIGNED_NOT_CHECKED_IN: 'bg-amber-500/25 border-amber-500/50 text-amber-950 dark:text-amber-100',
  CHECKED_IN: 'bg-emerald-500/30 border-emerald-500/50 text-emerald-950 dark:text-emerald-50',
  CHECKED_OUT: 'bg-slate-500/20 border-slate-500/40 text-slate-700 dark:text-slate-200',
  LATE: 'bg-orange-500/30 border-orange-500/50 text-orange-950 dark:text-orange-50',
  ABSENT: 'bg-red-500/15 border-red-500/30 text-red-900 dark:text-red-200',
  BLOCKED: 'bg-red-600/25 border-red-600/50 text-red-950 dark:text-red-100',
};

export function gridCellClass(state: BoardGridState): string {
  return cn('border transition-colors', GRID_STYLE[state]);
}
