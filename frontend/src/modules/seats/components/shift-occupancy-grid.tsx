'use client';

import { useMemo, useState } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Card, CardContent } from '@/components/ui/card';

import type { SeatGridCell, SeatGridSeat, SeatGridShift, SeatOccupancyGrid } from '../types';
import { cellStyle, OCCUPANCY_LEGEND } from './occupancy-cell-styles';
import { PublicHoldActionDialog } from './public-hold-action-dialog';
import { SeatAssignmentDialog } from './seat-assignment-dialog';

export interface ShiftOccupancyGridProps {
  grid: SeatOccupancyGrid;
  branchId: string;
  libraryId?: string;
  canAssign: boolean;
  onRefresh: () => void;
}

type DialogTarget = {
  seat: SeatGridSeat;
  shift: SeatGridShift;
  cell: SeatGridCell;
};

export function ShiftOccupancyGrid({
  grid,
  branchId,
  libraryId,
  canAssign,
  onRefresh,
}: ShiftOccupancyGridProps) {
  const [dialog, setDialog] = useState<DialogTarget | null>(null);
  const [pendingAssign, setPendingAssign] = useState<DialogTarget | null>(null);

  const seats = useMemo(() => [...grid.seats].sort((a, b) => a.seatNumber.localeCompare(b.seatNumber)), [grid.seats]);
  const shifts = grid.shifts;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Seats" value={grid.summary.totalSeats} />
        <SummaryCard label="Shifts" value={grid.summary.totalShifts} />
        <SummaryCard label="Partially used seats" value={grid.summary.partialSeats} />
        <SummaryCard label="Fully vacant seats" value={grid.summary.vacantSeats} />
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {OCCUPANCY_LEGEND.map((item) => (
          <span key={item.state} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>

      <Card className="overflow-hidden border-border/60 shadow-soft">
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[min(70vh,720px)]">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-20 min-w-[140px] border-b border-r bg-background px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    Shift
                  </th>
                  {seats.map((seat) => (
                    <th
                      key={seat._id}
                      className="sticky top-0 z-10 min-w-[4.5rem] border-b bg-background px-1 py-2 text-center text-xs font-semibold"
                    >
                      {seat.seatNumber}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift) => (
                  <tr key={shift._id}>
                    <th
                      className="sticky left-0 z-10 border-b border-r bg-background px-3 py-2 text-left align-middle"
                      style={{ boxShadow: '2px 0 4px -2px rgba(0,0,0,0.08)' }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: shift.color ?? '#3b82f6' }}
                        />
                        <div>
                          <p className="font-medium leading-tight">{shift.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {shift.startTime} – {shift.endTime}
                          </p>
                        </div>
                      </div>
                    </th>
                    {seats.map((seat) => {
                      const cell = grid.cells[shift._id]?.[seat._id] ?? {
                        state: 'AVAILABLE' as const,
                        availabilityHint: 'Available',
                      };
                      const style = cellStyle(cell.state);
                      const label =
                        cell.student?.fullName?.split(/\s+/)[0] ??
                        (cell.state === 'PUBLIC_HOLD' ? 'Hold' : cell.state === 'BLOCKED' ? '—' : '·');

                      return (
                        <td key={seat._id} className="border-b p-1 align-middle">
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  disabled={!canAssign}
                                  onClick={() => canAssign && setDialog({ seat, shift, cell })}
                                  className="flex h-11 w-full min-w-[4rem] flex-col items-center justify-center rounded-md border text-[10px] font-medium transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                                  style={{
                                    backgroundColor: style.bg,
                                    borderColor: style.border,
                                    color: style.text,
                                  }}
                                >
                                  <span className="max-w-full truncate px-0.5">{label}</span>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs space-y-1 text-xs">
                                <p className="font-semibold">
                                  Seat {seat.seatNumber} · {shift.name}
                                </p>
                                <p className="text-muted-foreground">
                                  Floor {seat.floor} · {seat.zone}
                                </p>
                                <p>
                                  {shift.startTime} – {shift.endTime}
                                </p>
                                <p>Status: {cell.state === 'PUBLIC_HOLD' ? 'Public hold' : cell.state}</p>
                                {cell.publicHold ? (
                                  <>
                                    <p className="font-medium">{cell.publicHold.fullName}</p>
                                    <p className="font-mono text-[10px]">{cell.publicHold.bookingReference}</p>
                                    <p>{cell.publicHold.phone}</p>
                                    {cell.publicHold.expiresAt ? (
                                      <p>Expires {new Date(cell.publicHold.expiresAt).toLocaleString()}</p>
                                    ) : null}
                                  </>
                                ) : cell.student ? (
                                  <>
                                    <p className="font-medium">{cell.student.fullName}</p>
                                    <p className="font-mono text-[10px]">{cell.student.studentCode}</p>
                                    {cell.student.phone ? <p>{cell.student.phone}</p> : null}
                                    {cell.student.membershipEndDate ? (
                                      <p>Valid until {cell.student.membershipEndDate.slice(0, 10)}</p>
                                    ) : null}
                                  </>
                                ) : (
                                  <p className="text-muted-foreground">
                                    {cell.availabilityHint ?? cell.conflictReason ?? 'Available'}
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {dialog?.cell.state === 'PUBLIC_HOLD' && dialog.cell.publicHold ? (
        <PublicHoldActionDialog
          open
          onOpenChange={(o) => {
            if (!o) setDialog(null);
          }}
          seat={dialog.seat}
          shift={dialog.shift}
          hold={dialog.cell.publicHold}
          onReleased={onRefresh}
          onOverrideAssign={() => {
            setPendingAssign(dialog);
            setDialog(null);
          }}
        />
      ) : null}

      {pendingAssign ? (
        <SeatAssignmentDialog
          open
          onOpenChange={(o) => !o && setPendingAssign(null)}
          branchId={branchId}
          libraryId={libraryId}
          seat={pendingAssign.seat}
          shift={pendingAssign.shift}
          cell={{ state: 'AVAILABLE', availabilityHint: 'Available after hold release' }}
          onSuccess={() => {
            setPendingAssign(null);
            onRefresh();
          }}
        />
      ) : null}

      {dialog && dialog.cell.state !== 'PUBLIC_HOLD' ? (
        <SeatAssignmentDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          branchId={branchId}
          libraryId={libraryId}
          seat={dialog.seat}
          shift={dialog.shift}
          cell={dialog.cell}
          onSuccess={onRefresh}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-border/60 shadow-soft">
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
