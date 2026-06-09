'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { formatEntityLabel } from '@/lib/entity-label';
import { PageHeader } from '@/components/common/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PERMISSIONS } from '@/constants/permissions';
import { studentDetailRoute } from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { ApiError } from '@/lib/api-error';
import { attendanceApi } from '@/modules/attendance/attendance.service';
import { attendanceQueryKeys } from '@/modules/attendance/attendance-query-keys';
import { AttendanceStatusBadge } from '@/modules/attendance/components/attendance-status-badge';

function studentLabel(row: Record<string, unknown>): string {
  if (row.studentName || row.studentCode || row.fullName) {
    return formatEntityLabel(row, 'student');
  }
  const student = row.studentId;
  if (!student || typeof student === 'string') return formatEntityLabel(null, 'student');
  return formatEntityLabel(student as Record<string, unknown>, 'student');
}

export default function AttendanceActivePage() {
  const { canAny } = usePermissions();
  const canRead = canAny([PERMISSIONS.ATTENDANCE_READ]);
  const canCheckOut = canAny([PERMISSIONS.ATTENDANCE_CHECK_OUT, PERMISSIONS.ATTENDANCE_CREATE]);
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const params = useMemo(
    () => ({ page, limit: 20, activeOnly: true, sortBy: 'checkInAt' as const, sortOrder: 'desc' as const }),
    [page],
  );
  const { data, isLoading } = useQuery({
    queryKey: attendanceQueryKeys.active(params),
    queryFn: () => attendanceApi.active(params),
    enabled: canRead,
  });

  const checkOutMutation = useMutation({
    mutationFn: (studentId: string) => attendanceApi.checkOut({ studentId }),
    onSuccess: () => {
      toast.success('Checked out');
      void qc.invalidateQueries({ queryKey: attendanceQueryKeys.all });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Checkout failed'),
  });

  if (!canRead) return <p className="text-sm text-muted-foreground">No attendance.read permission.</p>;
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <PageHeader title="Active check-ins" description="Students currently in library." />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Check-in at</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration so far</TableHead>
              <TableHead>Profile</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((row) => {
              const checkIn = row.checkInAt ? new Date(row.checkInAt) : null;
              const mins = checkIn ? Math.max(0, Math.floor((Date.now() - checkIn.getTime()) / 60000)) : 0;
              const studentId = typeof row.studentId === 'string' ? row.studentId : row.studentId._id;
              return (
                <TableRow key={row._id}>
                  <TableCell>{studentLabel(row as unknown as Record<string, unknown>)}</TableCell>
                  <TableCell>{checkIn ? checkIn.toLocaleString() : '-'}</TableCell>
                  <TableCell>
                    <AttendanceStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>{mins} min</TableCell>
                  <TableCell>
                    <Link
                      className="text-xs text-primary hover:underline"
                      href={`${studentDetailRoute(studentId)}?tab=attendance`}
                    >
                      View student details
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canCheckOut}
                      loading={checkOutMutation.isPending}
                      onClick={() => checkOutMutation.mutate(studentId)}
                    >
                      Check out
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">
          Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total} records
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!data.pagination.hasPrev} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={!data.pagination.hasNext} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
