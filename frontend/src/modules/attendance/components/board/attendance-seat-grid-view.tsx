'use client';

import { useMemo } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import type { AttendanceBoardGridCell, AttendanceBoardResponse } from '../../types-board';
import { BoardAttendanceStatusBadge, gridCellClass } from './board-attendance-status-badge';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function AttendanceSeatGridView({
  board,
  shiftFilter,
  onCellClick,
}: {
  board: AttendanceBoardResponse;
  shiftFilter: string;
  onCellClick: (cell: AttendanceBoardGridCell) => void;
}) {
  const shifts = useMemo(
    () =>
      shiftFilter
        ? board.shifts.filter((s) => s._id === shiftFilter)
        : board.shifts,
    [board.shifts, shiftFilter],
  );

  const cellMap = useMemo(() => {
    const m = new Map<string, AttendanceBoardGridCell>();
    for (const c of board.grid) {
      m.set(`${c.shiftId}:${c.seatId}`, c);
    }
    return m;
  }, [board.grid]);

  if (!board.seats.length) {
    return (
      <p className="rounded-lg border py-12 text-center text-sm text-muted-foreground">
        No seats configured for this branch.
      </p>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="overflow-auto rounded-lg border max-h-[min(70vh,720px)]">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-20 bg-background shadow-sm">
            <tr>
              <th className="sticky left-0 z-30 min-w-[120px] border-b border-r bg-muted/80 px-2 py-2 text-left font-medium">
                Shift
              </th>
              {board.seats.map((seat) => (
                <th
                  key={seat._id}
                  className="min-w-[3.25rem] border-b px-1 py-2 text-center font-medium whitespace-nowrap"
                >
                  {seat.seatNumber}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shifts.map((shift) => (
              <tr key={shift._id}>
                <td className="sticky left-0 z-10 border-r bg-muted/60 px-2 py-1 font-medium whitespace-nowrap">
                  <div>{shift.name}</div>
                  <div className="text-[10px] text-muted-foreground font-normal">
                    {shift.startTime}–{shift.endTime}
                  </div>
                </td>
                {board.seats.map((seat) => {
                  const cell = cellMap.get(`${shift._id}:${seat._id}`);
                  if (!cell) {
                    return (
                      <td key={seat._id} className="border p-0.5">
                        <div className="h-10 rounded-sm bg-muted/30" />
                      </td>
                    );
                  }
                  const label = cell.student
                    ? cell.student.studentName.split(/\s+/)[0] ?? initials(cell.student.studentName)
                    : '—';
                  return (
                    <td key={seat._id} className="border p-0.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            disabled={cell.state === 'VACANT' || cell.state === 'BLOCKED'}
                            onClick={() => onCellClick(cell)}
                            className={cn(
                              'flex h-10 w-full min-w-[3rem] flex-col items-center justify-center rounded-sm px-0.5 text-[10px] font-medium',
                              gridCellClass(cell.state),
                              (cell.state === 'VACANT' || cell.state === 'BLOCKED') &&
                                'cursor-default opacity-70',
                            )}
                          >
                            <span className="truncate max-w-full">{label}</span>
                            {cell.attendance ? (
                              <span
                                className={cn(
                                  'mt-0.5 h-1.5 w-1.5 rounded-full',
                                  cell.attendance.attendanceStatus === 'CHECKED_IN' && 'bg-emerald-500',
                                  cell.attendance.attendanceStatus === 'LATE' && 'bg-orange-500',
                                  cell.attendance.attendanceStatus === 'CHECKED_OUT' && 'bg-slate-400',
                                  cell.attendance.attendanceStatus === 'CHECKED_OUT_AUTO' && 'bg-violet-500',
                                  cell.attendance.attendanceStatus === 'NOT_CHECKED_IN' &&
                                    'bg-amber-400',
                                )}
                              />
                            ) : null}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs">
                          <p className="font-medium">
                            Seat {cell.seatNumber} · {cell.shiftName}
                          </p>
                          <p className="text-muted-foreground">{cell.shiftTime}</p>
                          {cell.student ? (
                            <>
                              <p className="mt-1">{cell.student.studentName}</p>
                              <p>{cell.student.studentCode}</p>
                              {cell.student.phone ? <p>{cell.student.phone}</p> : null}
                              {cell.student.membershipEndDate ? (
                                <p>
                                  Membership until{' '}
                                  {cell.student.membershipEndDate.slice(0, 10)}
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <p className="mt-1 capitalize">{cell.state.replace(/_/g, ' ').toLowerCase()}</p>
                          )}
                          {cell.attendance ? (
                            <p className="mt-1">
                              {cell.attendance.attendanceStatus.replace(/_/g, ' ')} · in{' '}
                              {formatTime(cell.attendance.checkInAt)} · out{' '}
                              {formatTime(cell.attendance.checkOutAt)}
                            </p>
                          ) : null}
                        </TooltipContent>
                      </Tooltip>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
}
