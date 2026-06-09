'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { formatEntityLabel } from '@/lib/entity-label';
import { PageHeader } from '@/components/common/page-header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PERMISSIONS } from '@/constants/permissions';
import { studentDetailRoute } from '@/constants/routes';
import { useDebounce } from '@/hooks/use-debounce';
import { usePermissions } from '@/hooks/use-permissions';
import { attendanceApi } from '@/modules/attendance/attendance.service';
import { attendanceQueryKeys } from '@/modules/attendance/attendance-query-keys';
import { AttendanceStatusBadge } from '@/modules/attendance/components/attendance-status-badge';

function studentLabel(row: Record<string, unknown>): string {
  if (row.studentName || row.studentCode || row.fullName) {
    return formatEntityLabel(row, 'student');
  }
  const student = row.studentId;
  if (!student) return formatEntityLabel(null, 'student');
  if (typeof student === 'string') return formatEntityLabel(null, 'student');
  return formatEntityLabel(student as Record<string, unknown>, 'student');
}

export default function AttendanceDailyPage() {
  const { can } = usePermissions();
  const canRead = can(PERMISSIONS.ATTENDANCE_READ);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState('');

  const params = useMemo(
    () => ({
      page,
      limit: 20,
      search: debouncedSearch || undefined,
      status: (status || undefined) as
        | 'PRESENT'
        | 'LATE'
        | 'ABSENT'
        | 'EARLY_EXIT'
        | 'CHECKED_IN'
        | 'CHECKED_OUT'
        | undefined,
      sortBy: 'checkInAt' as const,
      sortOrder: 'desc' as const,
    }),
    [page, debouncedSearch, status],
  );

  const { data, isLoading } = useQuery({
    queryKey: attendanceQueryKeys.daily(params),
    queryFn: () => attendanceApi.daily(params),
    enabled: canRead,
  });

  if (!canRead) return <p className="text-sm text-muted-foreground">No attendance.read permission.</p>;

  return (
    <div className="space-y-6">
      <PageHeader title="Daily attendance" />

      <div className="flex flex-wrap gap-3">
        <Input
          className="max-w-sm"
          placeholder="Search by name / studentId / phone"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {['PRESENT', 'LATE', 'ABSENT', 'EARLY_EXIT', 'CHECKED_IN', 'CHECKED_OUT'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell>{studentLabel(row as unknown as Record<string, unknown>)}</TableCell>
                    <TableCell>{row.checkInAt ? new Date(row.checkInAt).toLocaleString() : '-'}</TableCell>
                    <TableCell>{row.checkOutAt ? new Date(row.checkOutAt).toLocaleString() : '-'}</TableCell>
                    <TableCell>{row.durationMinutes} min</TableCell>
                    <TableCell>
                      <AttendanceStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell>{row.method}</TableCell>
                    <TableCell>
                      {typeof row.studentId === 'object' && row.studentId?._id ? (
                        <Link
                          className="text-xs text-primary hover:underline"
                          href={`${studentDetailRoute(row.studentId._id)}?tab=attendance`}
                        >
                          View student details
                        </Link>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between text-sm">
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
        </>
      )}
    </div>
  );
}
