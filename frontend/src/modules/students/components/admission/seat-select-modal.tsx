'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { seatApi } from '@/modules/seats/seat.service';
import type { SeatGridCell, SeatGridSeat } from '@/modules/seats/types';
import { cn } from '@/lib/utils';

export function SeatSelectModal({
  open,
  onOpenChange,
  branchId,
  shiftId,
  selectedSeatId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  shiftId: string;
  selectedSeatId: string;
  onSelect: (seat: SeatGridSeat) => void;
}) {
  const { data: grid, isLoading } = useQuery({
    queryKey: ['admission-seat-grid', branchId, shiftId],
    queryFn: () => seatApi.grid({ branchId }),
    enabled: open && Boolean(branchId && shiftId),
  });

  const shift = grid?.shifts.find((s) => s._id === shiftId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select seat</DialogTitle>
          <DialogDescription>
            {shift
              ? `${shift.name} (${shift.startTime}–${shift.endTime}) — available cells only`
              : 'Pick a shift first'}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !grid || !shift ? (
          <p className="text-sm text-muted-foreground">No grid data.</p>
        ) : (
          <div className="overflow-auto flex-1">
            <div className="flex flex-wrap gap-2 p-1">
              {grid.seats.map((seat) => {
                const cell: SeatGridCell | undefined = grid.cells[shiftId]?.[seat._id];
                const available = cell?.state === 'AVAILABLE';
                const selected = selectedSeatId === seat._id;
                return (
                  <button
                    key={seat._id}
                    type="button"
                    disabled={!available}
                    title={
                      cell?.state === 'PUBLIC_HOLD' && cell.publicHold
                        ? `Public hold: ${cell.publicHold.fullName} until ${cell.publicHold.expiresAt ? new Date(cell.publicHold.expiresAt).toLocaleString() : '—'}`
                        : cell?.conflictReason ?? cell?.availabilityHint ?? seat.seatNumber
                    }
                    onClick={() => {
                      if (!available) return;
                      onSelect(seat);
                      onOpenChange(false);
                    }}
                    className={cn(
                      'min-w-[3rem] rounded-md border px-2 py-2 text-xs font-medium transition-colors',
                      available && 'hover:border-primary hover:bg-primary/10',
                      !available && 'cursor-not-allowed opacity-50',
                      selected && 'border-primary bg-primary/15 ring-2 ring-primary',
                      cell?.state === 'OCCUPIED' && 'bg-blue-500/20',
                      cell?.state === 'RESERVED' && 'bg-amber-500/20',
                      cell?.state === 'PUBLIC_HOLD' && 'bg-violet-500/25 border-violet-400',
                      cell?.state === 'BLOCKED' && 'bg-red-500/15',
                    )}
                  >
                    {seat.seatNumber}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
