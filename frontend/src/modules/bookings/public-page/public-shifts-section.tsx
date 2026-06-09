'use client';

import Link from 'next/link';
import { Clock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { PublicLibraryProfile } from '@/modules/bookings/types';

import { formatCurrency, formatShiftTime } from './utils';

type PublicShiftsSectionProps = {
  slug: string;
  data: PublicLibraryProfile;
  branchId?: string;
  selectedShiftId?: string;
  onChooseShift?: (shiftId: string, branchId: string) => void;
  compact?: boolean;
};

export function PublicShiftsSection({
  slug,
  data,
  branchId,
  selectedShiftId,
  onChooseShift,
  compact,
}: PublicShiftsSectionProps) {
  const { shifts, branches, booking, shiftStats } = data;

  const branchName = (id: string) => branches.find((b) => b._id === id)?.branchName ?? 'Branch';

  const visibleShifts = shifts.filter((s) => !branchId || s.branchId === branchId);

  const statsFor = (shiftId: string) => shiftStats?.find((row) => row.shiftId === shiftId);

  if (!visibleShifts.length) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Choose your study shift</h2>
        <p className="text-sm text-muted-foreground">Visit the library for shift and pricing details.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Choose your study shift</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a shift that matches your study time.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {visibleShifts.map((shift) => {
          const stats = statsFor(shift._id);
          const availableSeats = stats?.availableSeats;
          const startingPrice = stats?.startingPrice;
          const isSelected = selectedShiftId === shift._id;

          return (
            <Card
              key={shift._id}
              className={`overflow-hidden border-slate-200/80 shadow-sm dark:border-slate-800 ${
                isSelected ? 'ring-2 ring-primary/40' : ''
              }`}
            >
              <CardHeader className="space-y-1 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{shift.name}</CardTitle>
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: shift.color || '#6366f1' }}
                    aria-hidden
                  />
                </div>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {formatShiftTime(shift.startTime, shift.endTime)}
                </p>
                <p className="text-xs text-muted-foreground">{branchName(shift.branchId)}</p>
              </CardHeader>
              <CardContent className="space-y-2 pb-2">
                {typeof availableSeats === 'number' ? (
                  <p className="text-sm font-medium">
                    {availableSeats} seat{availableSeats === 1 ? '' : 's'} available
                  </p>
                ) : null}
                {startingPrice != null ? (
                  <p className="text-sm text-muted-foreground">
                    Plans from{' '}
                    <span className="font-semibold text-foreground">{formatCurrency(startingPrice)}</span>
                    {stats?.startingDurationDays ? (
                      <span className="text-xs"> / {stats.startingDurationDays} days</span>
                    ) : null}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Visit the library for pricing details.</p>
                )}
              </CardContent>
              {booking.enabled ? (
                <CardFooter>
                  {onChooseShift ? (
                    <Button
                      type="button"
                      className="w-full"
                      variant={compact && !isSelected ? 'outline' : 'default'}
                      onClick={() => onChooseShift(shift._id, shift.branchId)}
                    >
                      {isSelected ? 'Shift selected' : 'Choose shift'}
                    </Button>
                  ) : (
                    <Button asChild className="w-full">
                      <Link href={`/l/${slug}/book?shift=${shift._id}&branch=${shift.branchId}`}>
                        Choose shift
                      </Link>
                    </Button>
                  )}
                </CardFooter>
              ) : null}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
