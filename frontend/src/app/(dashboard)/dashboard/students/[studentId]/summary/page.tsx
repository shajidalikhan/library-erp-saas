'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { studentDetailRoute } from '@/constants/routes';
import { studentApi } from '@/modules/students/student.service';
import { studentQueryKeys } from '@/modules/students/student-query-keys';

export default function StudentSummaryPage() {
  const params = useParams<{ studentId: string }>();
  const studentId = params.studentId;

  const { data, isLoading, error } = useQuery({
    queryKey: studentQueryKeys.summary(studentId),
    queryFn: () => studentApi.summary(studentId),
    enabled: Boolean(studentId),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student profile summary"
        description="Condensed operational snapshot for front-desk and finance."
        actions={
          <Link
            href={studentDetailRoute(studentId)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to student
          </Link>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : error || !data ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Unable to load summary.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="border-border/60 shadow-soft lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{data.student.fullName}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Student ID:</span>{' '}
                <span className="font-mono text-xs">{data.student.studentId}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Status:</span> {data.student.status}
              </p>
              <p>
                <span className="text-muted-foreground">Email:</span> {data.student.email ?? '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Phone:</span> {data.student.phone ?? '—'}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">Membership</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">Expires</p>
              <p className="text-lg font-semibold">
                {data.membership.endDate ? data.membership.endDate.slice(0, 10) : 'Open'}
              </p>
              <p className={data.membership.isExpired ? 'text-destructive' : 'text-emerald-600'}>
                {data.membership.isExpired ? 'Expired' : 'Active window'}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">Attendance (preview)</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Sessions (30d): {data.attendance.sessionsLast30d}</p>
              <p>Last check-in: {data.attendance.lastCheckInAt ?? '—'}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">Payments (preview)</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Outstanding: {data.payments.outstandingAmount} {data.payments.currency}
              </p>
              <p>Last payment: {data.payments.lastPaymentAt ?? '—'}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
