'use client';

import Link from 'next/link';
import { Armchair, Clock, Grid3x3, Layers } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ROUTES,
  seatBulkRoute,
  seatGridRoute,
  seatNewRoute,
} from '@/constants/routes';

export function SeatSetupEmptyState({
  branchId,
  hasShifts,
  hasSeats,
}: {
  branchId?: string;
  hasShifts?: boolean;
  hasSeats?: boolean;
}) {
  const step = !hasShifts ? 1 : !hasSeats ? 2 : 3;

  return (
    <Card className="border-dashed border-border/80 bg-muted/20">
      <CardHeader>
        <CardTitle className="text-base">Set up seats for your library</CardTitle>
        <CardDescription>
          The occupancy grid needs branch shifts and seat numbers. Complete these steps in order.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-3 text-sm">
          <li className={`flex gap-3 ${step === 1 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
            <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              <strong>1. Define shifts</strong> — Morning, Evening, Full day, etc.
              {step === 1 ? (
                <span className="mt-2 block">
                  <Button size="sm" asChild>
                    <Link href={ROUTES.SHIFTS}>Open shift management</Link>
                  </Button>
                </span>
              ) : null}
            </span>
          </li>
          <li className={`flex gap-3 ${step === 2 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
            <Armchair className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              <strong>2. Add seats</strong> — Create seat numbers for this branch.
              {step === 2 ? (
                <span className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" asChild>
                    <Link href={seatNewRoute()}>Add one seat</Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={seatBulkRoute()}>Bulk create</Link>
                  </Button>
                </span>
              ) : null}
            </span>
          </li>
          <li className={`flex gap-3 ${step === 3 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
            <Grid3x3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              <strong>3. Open occupancy grid</strong> — Assign students per shift.
              {step === 3 && branchId ? (
                <span className="mt-2 block">
                  <Button size="sm" asChild>
                    <Link href={seatGridRoute()}>Open grid</Link>
                  </Button>
                </span>
              ) : null}
            </span>
          </li>
        </ol>
        {!branchId ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Layers className="h-3.5 w-3.5" />
            Select a branch above to continue.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
