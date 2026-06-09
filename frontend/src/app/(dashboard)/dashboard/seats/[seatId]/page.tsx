'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { formatEntityLabel } from '@/lib/entity-label';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Can } from '@/components/auth/can';
import { PERMISSIONS } from '@/constants/permissions';
import { ROUTES, seatAssignRoute, seatEditRoute, studentDetailRoute } from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { ApiError } from '@/lib/api-error';
import { seatApi } from '@/modules/seats/seat.service';
import { seatQueryKeys } from '@/modules/seats/seat-query-keys';
import { SeatStatusBadge } from '@/modules/seats/components/seat-status-badge';

export default function SeatDetailPage() {
  const params = useParams();
  const qc = useQueryClient();
  const seatId = String(params.seatId ?? '');
  const { canAny } = usePermissions();
  const canView = canAny([PERMISSIONS.SEAT_READ, PERMISSIONS.SEAT_OCCUPANCY_READ]);
  const [unassignOpen, setUnassignOpen] = useState(false);

  const { data: seat, isLoading } = useQuery({
    queryKey: seatQueryKeys.detail(seatId),
    queryFn: () => seatApi.get(seatId),
    enabled: Boolean(seatId) && canView,
  });

  const doUnassign = async () => {
    try {
      await seatApi.unassign(seatId);
      toast.success('Unassigned');
      setUnassignOpen(false);
      await qc.invalidateQueries({ queryKey: seatQueryKeys.detail(seatId) });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed');
    }
  };

  if (!canView) return <p className="text-sm text-muted-foreground">No access.</p>;
  if (isLoading || !seat) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={seat.seatNumber}
        description={`${seat.floor} · ${seat.zone}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={ROUTES.SEATS}>All seats</Link>
            </Button>
            <Can permission={PERMISSIONS.SEAT_UPDATE}>
              <Button variant="outline" asChild>
                <Link href={seatEditRoute(seatId)}>Edit</Link>
              </Button>
            </Can>
            <Can permission={PERMISSIONS.SEAT_ASSIGN}>
              <Button asChild>
                <Link href={seatAssignRoute(seatId)}>Assign student</Link>
              </Button>
            </Can>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <SeatStatusBadge status={seat.status} />
              {seat.occupied ? <span className="text-muted-foreground">Occupied</span> : null}
            </div>
            <p>Type: {seat.seatType}</p>
            {seat.shiftAssignments?.length ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">Shift occupancy</p>
                {seat.shiftAssignments.map((a) => (
                  <p key={a._id} className="text-sm text-muted-foreground">
                    {typeof a.shiftId === 'object' && a.shiftId?.name ? a.shiftId.name : 'Shift'}:{' '}
                    {typeof a.studentId === 'object' && a.studentId?.fullName
                      ? a.studentId.fullName
                      : '—'}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No shift assignments yet.</p>
            )}
            <p>Active: {seat.active ? 'Yes' : 'No'}</p>
            {seat.reservedUntil ? <p>Reserved until: {new Date(seat.reservedUntil).toLocaleString()}</p> : null}
            {seat.notes ? <p className="text-muted-foreground">{seat.notes}</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assignment</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            {seat.assignedStudentId ? (
              <>
                <p>Student: {formatEntityLabel(seat, 'student')}</p>
                <Button variant="outline" size="sm" asChild>
                  <Link href={studentDetailRoute(seat.assignedStudentId)}>Open student</Link>
                </Button>
                <Can permission={PERMISSIONS.SEAT_UNASSIGN}>
                  <Button variant="secondary" size="sm" onClick={() => setUnassignOpen(true)}>
                    Unassign
                  </Button>
                </Can>
              </>
            ) : (
              <p className="text-muted-foreground">No student assigned.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={unassignOpen} onOpenChange={setUnassignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unassign seat?</DialogTitle>
            <DialogDescription>The student will lose this seat assignment.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnassignOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doUnassign}>Unassign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
