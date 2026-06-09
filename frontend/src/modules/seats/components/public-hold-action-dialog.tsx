'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ROUTES } from '@/constants/routes';
import { PERMISSIONS, ROLES } from '@/constants/permissions';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuth } from '@/hooks/use-auth';
import { bookingsApi } from '@/modules/bookings/bookings.service';
import type { PublicHoldSummary, SeatGridSeat, SeatGridShift } from '@/modules/seats/types';

export interface PublicHoldActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seat: SeatGridSeat;
  shift: SeatGridShift;
  hold: PublicHoldSummary;
  onReleased: () => void;
  onOverrideAssign: () => void;
}

export function PublicHoldActionDialog({
  open,
  onOpenChange,
  seat,
  shift,
  hold,
  onReleased,
  onOverrideAssign,
}: PublicHoldActionDialogProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { canAny, hasRole } = usePermissions();
  const [busy, setBusy] = useState<string | null>(null);

  const canOverride =
    hasRole(ROLES.LIBRARY_OWNER, ROLES.SUPER_ADMIN) ||
    canAny([PERMISSIONS.BOOKING_MANAGE, PERMISSIONS.SEAT_ASSIGN, PERMISSIONS.BOOKING_UPDATE]);

  const canConvert = canAny([PERMISSIONS.BOOKING_CONVERT, PERMISSIONS.BOOKING_MANAGE]);

  const releaseMutation = useMutation({
    mutationFn: (note?: string) => bookingsApi.releasePublicHold(hold.bookingId, note),
    onSuccess: () => {
      toast.success('Public hold released');
      onReleased();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || 'Could not release hold'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => bookingsApi.rejectBooking(hold.bookingId, 'Cancelled from seat grid'),
    onSuccess: () => {
      toast.success('Public hold cancelled');
      onReleased();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || 'Could not cancel hold'),
  });

  const convertMutation = useMutation({
    mutationFn: () => bookingsApi.convertToStudent(hold.bookingId),
    onSuccess: () => {
      toast.success('Converted to student');
      onReleased();
      onOpenChange(false);
      router.push(`${ROUTES.STUDENTS}?booking=${hold.bookingId}`);
    },
    onError: (e: Error) => toast.error(e.message || 'Conversion failed'),
  });

  const expiresLabel = hold.expiresAt
    ? new Date(hold.expiresAt).toLocaleString()
    : 'soon';

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Public booking hold</DialogTitle>
          <DialogDescription>
            Seat {seat.seatNumber} · {shift.name} is held by a visitor until {expiresLabel}.
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Reference</dt>
            <dd className="font-mono font-medium">{hold.bookingReference}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Visitor</dt>
            <dd className="font-medium">{hold.fullName}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Phone</dt>
            <dd>{hold.phone}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Status</dt>
            <dd>{hold.status}</dd>
          </div>
        </dl>

        <DialogFooter className="flex flex-col gap-2 sm:flex-col sm:items-stretch">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Keep reserved
          </Button>
          {canConvert ? (
            <Button
              type="button"
              variant="secondary"
              disabled={Boolean(busy)}
              onClick={() => void run('convert', () => convertMutation.mutateAsync())}
            >
              {busy === 'convert' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Convert booking to student
            </Button>
          ) : null}
          {canOverride ? (
            <>
              <Button
                type="button"
                disabled={Boolean(busy)}
                onClick={() =>
                  void run('override', async () => {
                    await releaseMutation.mutateAsync(
                      'Released by staff for internal assignment',
                    );
                    onOverrideAssign();
                  })
                }
              >
                {busy === 'override' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Override and assign seat
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={Boolean(busy)}
                onClick={() => void run('cancel', () => rejectMutation.mutateAsync())}
              >
                {busy === 'cancel' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Cancel public hold
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              You need booking.manage or seat.assign permission to override this hold.
            </p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
