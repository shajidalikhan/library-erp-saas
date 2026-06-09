'use client';

import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { studentApi } from '@/modules/students/student.service';
import { AttendanceStatusBadge } from '@/modules/attendance/components/attendance-status-badge';

export default function MyAttendancePage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['student', 'me', 'attendance'],
    queryFn: () => studentApi.myAttendance({ page: 1, limit: 20 }),
  });

  if (isLoading) return <Skeleton className="h-72 w-full rounded-xl" />;
  if (isError || !data) return <p className="text-sm text-muted-foreground">Unable to load attendance.</p>;
  if (data.items.length === 0) return <p className="text-sm text-muted-foreground">No attendance records yet.</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Attendance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {(data.items as Array<{ _id: string; date?: string; status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EARLY_EXIT' | 'CHECKED_IN' | 'CHECKED_OUT'; checkInAt?: string; checkOutAt?: string }>).map((row) => (
          <div key={row._id} className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p>{row.date ? new Date(row.date).toLocaleDateString() : '-'}</p>
              <p className="text-xs text-muted-foreground">
                {row.checkInAt ? new Date(row.checkInAt).toLocaleString() : '-'} -{' '}
                {row.checkOutAt ? new Date(row.checkOutAt).toLocaleString() : '-'}
              </p>
            </div>
            <AttendanceStatusBadge status={row.status} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
