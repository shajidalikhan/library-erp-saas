'use client';

import { useMemo } from 'react';
import { CheckCircle2, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PublicAvailabilityResponse, PublicLibraryProfile } from '@/modules/bookings/types';

import {
  getPublicSeatCellClass,
  getPublicSeatTooltip,
  isPublicSeatSelectable,
  PUBLIC_SEAT_LEGEND_FULL,
  PUBLIC_SEAT_LEGEND_SIMPLE,
  showFullSeatBreakdown,
  type PublicSeatStatus,
} from './public-visibility';

const LEGEND_CLASS: Record<string, string> = {
  AVAILABLE: 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40',
  OCCUPIED: 'border-rose-400 bg-rose-50 text-rose-900 dark:bg-rose-950/40',
  RESERVED: 'border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/40',
  BLOCKED: 'border-slate-400 bg-slate-100 text-slate-700 dark:bg-slate-800',
  NOT_AVAILABLE: 'border-slate-400 bg-slate-100 text-slate-600 dark:bg-slate-800',
};

type PublicSeatMatrixProps = {
  profile: PublicLibraryProfile;
  availability?: PublicAvailabilityResponse;
  branchId: string;
  shiftId: string;
  feePlanId: string;
  seatId: string;
  onSeatSelect: (id: string) => void;
  onContinue?: () => void;
  hideFilters?: boolean;
};

export function PublicSeatMatrix({
  profile,
  availability,
  branchId,
  shiftId,
  feePlanId,
  seatId,
  onSeatSelect,
  onContinue,
  hideFilters,
}: PublicSeatMatrixProps) {
  const showFull = showFullSeatBreakdown(profile);
  const legend = showFull ? PUBLIC_SEAT_LEGEND_FULL : PUBLIC_SEAT_LEGEND_SIMPLE;

  const selectedSeat = availability?.seats.find((s) => s._id === seatId);
  const selectedShift = profile.shifts.find((s) => s._id === shiftId);

  const branchLabel = useMemo(
    () => profile.branches.find((b) => b._id === branchId)?.branchName,
    [profile.branches, branchId],
  );

  const planReady = Boolean(feePlanId);
  const canPickSeats = Boolean(branchId && shiftId && planReady);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Choose your seat</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select an available seat. Your seat will be held for 3 hours.
        </p>
      </div>
      <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
        <CardHeader className="space-y-4 pb-2">
          {!hideFilters ? null : (
            <CardTitle className="text-base font-medium text-muted-foreground">
              {branchLabel && selectedShift
                ? `${branchLabel} · ${selectedShift.name}`
                : 'Seat layout'}
            </CardTitle>
          )}
          <div className="flex flex-wrap gap-2">
            {legend.map((item) => (
              <span
                key={item.status}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium',
                  LEGEND_CLASS[item.status] ?? LEGEND_CLASS.NOT_AVAILABLE,
                )}
              >
                {item.label}
              </span>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canPickSeats ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {!branchId || !shiftId
                ? 'Select a branch and shift first.'
                : 'Select a plan before choosing your seat.'}
            </p>
          ) : !availability?.seats.length ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Loading seats…
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {availability.seats.map((seat) => {
                const status = seat.status as PublicSeatStatus;
                const selectable = isPublicSeatSelectable(status);
                const isSelected = seatId === seat._id;
                return (
                  <button
                    key={seat._id}
                    type="button"
                    title={getPublicSeatTooltip(status, showFull)}
                    disabled={!selectable}
                    onClick={() => selectable && onSeatSelect(seat._id)}
                    className={cn(
                      'flex min-h-[72px] flex-col items-center justify-center rounded-xl border p-2 text-center transition',
                      getPublicSeatCellClass(status, showFull, isSelected),
                    )}
                  >
                    <span className="text-sm font-bold">{seat.seatNumber}</span>
                    {(seat.zone || seat.floor) && (
                      <span className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                        {[seat.zone, seat.floor].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {selectedSeat && selectedShift ? (
            <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Seat {selectedSeat.seatNumber} selected</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedShift.name} ·{' '}
                    {[selectedSeat.zone, selectedSeat.floor].filter(Boolean).join(' · ') ||
                      'Main hall'}
                  </p>
                </div>
              </div>
              {onContinue ? (
                <Button type="button" onClick={onContinue}>
                  Continue booking
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              Tap an available seat to continue. Student details are never shown on this page.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
