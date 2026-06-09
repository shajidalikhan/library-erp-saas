'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { formatEntityLabel } from '@/lib/entity-label';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/use-permissions';
import { attendanceApi } from '@/modules/attendance/attendance.service';
import { attendanceQueryKeys } from '@/modules/attendance/attendance-query-keys';

export default function AttendanceSummaryPage() {
  const { canAny } = usePermissions();
  const canRead = canAny([PERMISSIONS.ATTENDANCE_SUMMARY, PERMISSIONS.ATTENDANCE_READ]);
  const [days, setDays] = useState(7);

  const params = useMemo(() => {
    const now = new Date();
    const from = new Date();
    from.setDate(now.getDate() - days);
    return { dateFrom: from.toISOString(), dateTo: now.toISOString() };
  }, [days]);

  const { data, isLoading } = useQuery({
    queryKey: attendanceQueryKeys.summary(params),
    queryFn: () => attendanceApi.summary(params),
    enabled: canRead,
  });

  if (!canRead) return <p className="text-sm text-muted-foreground">No summary access.</p>;

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance summary" />
      <div className="flex gap-2">
        {[1, 7, 30].map((d) => (
          <Button key={d} variant={days === d ? 'default' : 'outline'} size="sm" onClick={() => setDays(d)}>
            Last {d} day{d > 1 ? 's' : ''}
          </Button>
        ))}
      </div>
      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Loading summary…</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader>
              <CardContent className="text-3xl font-semibold">{data.total}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Checked out</CardTitle></CardHeader>
              <CardContent className="text-3xl font-semibold">{data.checkedOut}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-muted-foreground">Active</CardTitle></CardHeader>
              <CardContent className="text-3xl font-semibold">{data.activeCheckIns}</CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Branch-wise</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.byBranch.length === 0 ? (
                <p className="text-sm text-muted-foreground">No records in selected period.</p>
              ) : (
                data.byBranch.map((b) => (
                  <div key={b.branchId} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span>{formatEntityLabel(b, 'branch')}</span>
                    <span className="font-medium">{b.count}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
