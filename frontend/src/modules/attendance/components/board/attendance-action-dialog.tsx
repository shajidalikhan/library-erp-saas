'use client';

import Link from 'next/link';
import { Loader2, User } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PERMISSIONS } from '@/constants/permissions';
import {
  paymentCollectStudentRoute,
  studentDetailRoute,
} from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { formatCurrency } from '@/lib/utils';

import type { AttendanceBoardGridCell, AttendanceBoardStudent } from '../../types-board';
import { isStudentCheckedIn } from '../../types-board';
import { BoardAttendanceStatusBadge } from './board-attendance-status-badge';

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function AttendanceActionDialog({
  open,
  onOpenChange,
  student,
  cell,
  onCheckIn,
  onCheckOut,
  checkingIn,
  checkingOut,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: AttendanceBoardStudent | null;
  cell: AttendanceBoardGridCell | null;
  onCheckIn: () => void;
  onCheckOut: () => void;
  checkingIn: boolean;
  checkingOut: boolean;
}) {
  const { canAny } = usePermissions();
  const canCheckIn = canAny([PERMISSIONS.ATTENDANCE_CHECK_IN, PERMISSIONS.ATTENDANCE_CREATE]);
  const canCheckOut = canAny([PERMISSIONS.ATTENDANCE_CHECK_OUT, PERMISSIONS.ATTENDANCE_CREATE]);
  const canPay = canAny([PERMISSIONS.PAYMENT_CREATE, PERMISSIONS.PAYMENT_READ]);

  if (!student) return null;

  const isInside = isStudentCheckedIn(student);
  const seatLabel = cell?.seatNumber ?? student.seatNumber ?? '—';
  const shiftLabel = cell
    ? `${cell.shiftName} (${cell.shiftTime})`
    : student.shiftName ?? '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{student.studentName}</DialogTitle>
          <DialogDescription>
            {student.studentCode}
            {student.phone ? ` · ${student.phone}` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3">
          <Avatar className="h-14 w-14">
            {student.photoUrl ? <AvatarImage src={student.photoUrl} alt="" /> : null}
            <AvatarFallback>
              {student.studentName
                .split(/\s+/)
                .map((p) => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-2 text-sm flex-1">
            <BoardAttendanceStatusBadge status={student.attendanceStatus} />
            <p>
              <span className="text-muted-foreground">Seat:</span> {seatLabel}
            </p>
            <p>
              <span className="text-muted-foreground">Shift:</span> {shiftLabel}
            </p>
            <p>
              <span className="text-muted-foreground">Membership:</span> {student.membershipStatus}
              {student.membershipEndDate
                ? ` · until ${student.membershipEndDate.slice(0, 10)}`
                : ''}
            </p>
            <p>
              <span className="text-muted-foreground">Check-in:</span> {formatTime(student.checkInAt)}
              {' · '}
              <span className="text-muted-foreground">Out:</span> {formatTime(student.checkOutAt)}
            </p>
            {student.dueAmount > 0 && canPay ? (
              <p className="font-medium text-amber-700 dark:text-amber-400">
                Due {formatCurrency(student.dueAmount, 'INR')}
              </p>
            ) : null}
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
          <div className="flex flex-wrap gap-2">
            {canCheckIn && !isInside ? (
              <Button onClick={onCheckIn} disabled={checkingIn}>
                {checkingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Check in
              </Button>
            ) : null}
            {canCheckOut && isInside ? (
              <Button variant="secondary" onClick={onCheckOut} disabled={checkingOut}>
                {checkingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Check out
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <Link href={studentDetailRoute(student.studentId)}>
                <User className="mr-2 h-4 w-4" />
                View student
              </Link>
            </Button>
            {student.dueAmount > 0 && canPay ? (
              <Button variant="outline" asChild>
                <Link href={paymentCollectStudentRoute(student.studentId)}>View payment due</Link>
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
