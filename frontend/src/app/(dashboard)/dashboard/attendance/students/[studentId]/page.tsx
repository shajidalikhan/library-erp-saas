'use client';

import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/use-permissions';
import { attendanceApi } from '@/modules/attendance/attendance.service';
import { attendanceQueryKeys } from '@/modules/attendance/attendance-query-keys';
import { AttendanceStatusBadge } from '@/modules/attendance/components/attendance-status-badge';

export default function StudentAttendanceHistoryPage() {
  const { can } = usePermissions();
  const canRead = can(PERMISSIONS.ATTENDANCE_READ);
  const params = useParams();
  const studentId = String(params.studentId ?? '');
  const [page, setPage] = useState(1);

  const queryParams = useMemo(
    () => ({ page, limit: 20, sortBy: 'date' as const, sortOrder: 'desc' as const }),
    [page],
  );
  const { data, isLoading } = useQuery({
    queryKey: attendanceQueryKeys.studentHistory(studentId, queryParams),
    queryFn: () => attendanceApi.studentHistory(studentId, queryParams),
    enabled: canRead && Boolean(studentId),
  });

  if (!canRead) return <p className="text-sm text-muted-foreground">No attendance.read permission.</p>;

  return (
    <div className="space-y-6">
      <PageHeader title="Student attendance history" description={studentId} />
      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((r) => (
                  <TableRow key={r._id}>
                    <TableCell>{new Date(r.date).toLocaleDateString()}</TableCell>
                    <TableCell>{r.checkInAt ? new Date(r.checkInAt).toLocaleString() : '-'}</TableCell>
                    <TableCell>{r.checkOutAt ? new Date(r.checkOutAt).toLocaleString() : '-'}</TableCell>
                    <TableCell>{r.durationMinutes} min</TableCell>
                    <TableCell><AttendanceStatusBadge status={r.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={!data.pagination.hasPrev} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={!data.pagination.hasNext} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
