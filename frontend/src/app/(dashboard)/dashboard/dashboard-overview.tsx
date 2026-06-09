'use client';

import Link from 'next/link';
import {
  ArrowUpRight,
  Armchair,
  ClipboardCheck,
  Clock,
  CreditCard,
  Grid3x3,
  Users,
  Plus,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/common/page-header';
import { RecentActivityFeed } from '@/components/dashboard/recent-activity-feed';
import { Can } from '@/components/auth/can';
import { PERMISSIONS } from '@/constants/permissions';
import { ROUTES, seatBulkRoute, seatGridRoute, seatNewRoute } from '@/constants/routes';
import { formatCurrency } from '@/lib/utils';
import { selectUser, useAuthStore } from '@/store/auth.store';
import { usePermissions } from '@/hooks/use-permissions';
import { analyticsApi } from '@/modules/analytics/analytics.service';
import { analyticsQueryKeys } from '@/modules/analytics/analytics-query-keys';
import type { AnalyticsQueryParams } from '@/modules/analytics/types';
import { useSubscriptionUsage } from '@/modules/subscription/hooks/use-subscription-usage';
import { PlanLimitButton } from '@/modules/subscription/components/plan-limit-button';
import { ROLES } from '@/constants/permissions';
import { useTenantScope } from '@/hooks/use-tenant-scope';

/**
 * Dashboard overview — KPIs from analytics overview API when permitted.
 */

export function DashboardOverview() {
  const user = useAuthStore(selectUser);
  const { canAny } = usePermissions();
  const { isSuperAdmin, effectiveLibraryId, effectiveBranchId } = useTenantScope();
  const showAnalytics = canAny([PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.REPORT_VIEW]);

  const overviewParams: AnalyticsQueryParams | undefined = user
    ? {
        libraryId: isSuperAdmin
          ? effectiveLibraryId || undefined
          : user.libraryId ?? undefined,
        branchId: isSuperAdmin
          ? effectiveBranchId || undefined
          : user.branchId ?? undefined,
        range: '30d',
      }
    : undefined;

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: analyticsQueryKeys.overview(overviewParams),
    queryFn: () => analyticsApi.overview(overviewParams),
    enabled: Boolean(showAnalytics && user),
  });

  const isOwner = user?.role === ROLES.LIBRARY_OWNER;
  const { canCreate } = useSubscriptionUsage();

  return (
    <div className="space-y-6">
      <PageHeader
        title={user ? `Welcome back, ${user.fullName.split(' ')[0]}` : 'Dashboard'}
        description="Here's what's happening across your library today."
        actions={
          <Can permission={PERMISSIONS.STUDENT_CREATE}>
            <PlanLimitButton entity="students" blocked={!canCreate('students')} asChild>
              <Link href={ROUTES.STUDENTS}>
                <Plus className="h-4 w-4" /> Add Student
              </Link>
            </PlanLimitButton>
          </Can>
        }
      />

      {showAnalytics &&
      !overviewLoading &&
      overview?.totalSeats === 0 &&
      canAny([PERMISSIONS.SEAT_CREATE, PERMISSIONS.SHIFT_CREATE]) ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Set up your reading hall</CardTitle>
            <CardDescription>
              Your dashboard will show occupancy once you add shifts and seats for a branch.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Can permission={PERMISSIONS.SHIFT_CREATE}>
              <Button size="sm" asChild>
                <Link href={ROUTES.SHIFTS}>
                  <Clock className="mr-2 h-4 w-4" />
                  Define shifts
                </Link>
              </Button>
            </Can>
            <Can permission={PERMISSIONS.SEAT_CREATE}>
              <PlanLimitButton entity="seats" blocked={!canCreate('seats')} size="sm" variant="outline" asChild>
                <Link href={seatNewRoute()}>
                  <Armchair className="mr-2 h-4 w-4" />
                  Add seats
                </Link>
              </PlanLimitButton>
              <PlanLimitButton entity="seats" blocked={!canCreate('seats')} size="sm" variant="outline" asChild>
                <Link href={seatBulkRoute()}>Bulk create</Link>
              </PlanLimitButton>
            </Can>
            <Can permission={PERMISSIONS.SEAT_READ}>
              <Button size="sm" variant="outline" asChild>
                <Link href={seatGridRoute()}>
                  <Grid3x3 className="mr-2 h-4 w-4" />
                  Occupancy grid
                </Link>
              </Button>
            </Can>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Can permission={PERMISSIONS.STUDENT_READ}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total students</CardTitle>
              <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                <Users className="h-4 w-4" aria-hidden />
              </div>
            </CardHeader>
            <CardContent>
              {showAnalytics && overviewLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-semibold">
                    {overview?.totalStudents != null ? overview.totalStudents : '—'}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {overview?.activeStudents != null ? `${overview.activeStudents} active` : ' '}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Can>

        <Can permission={PERMISSIONS.SEAT_READ}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Occupancy</CardTitle>
              <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                <Armchair className="h-4 w-4" aria-hidden />
              </div>
            </CardHeader>
            <CardContent>
              {showAnalytics && overviewLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-semibold">
                    {overview?.occupancyPct != null ? `${overview.occupancyPct}%` : '—'}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {overview?.occupiedSeats != null && overview?.totalSeats != null
                      ? `${overview.occupiedSeats} / ${overview.totalSeats} seats`
                      : ' '}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Can>

        <Can permission={PERMISSIONS.ATTENDANCE_READ}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today&apos;s attendance</CardTitle>
              <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                <ClipboardCheck className="h-4 w-4" aria-hidden />
              </div>
            </CardHeader>
            <CardContent>
              {showAnalytics && overviewLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-semibold">
                    {overview?.todayAttendance != null ? overview.todayAttendance : '—'}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="mr-1">
                      Live
                    </Badge>
                    check-ins today
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </Can>

        <Can permission={PERMISSIONS.PAYMENT_READ}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue (MTD)</CardTitle>
              <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
                <CreditCard className="h-4 w-4" aria-hidden />
              </div>
            </CardHeader>
            <CardContent>
              {showAnalytics && overviewLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <>
                  <div className="text-2xl font-semibold">
                    {overview?.monthlyRevenue != null ? formatCurrency(overview.monthlyRevenue) : '—'}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Collected this month</p>
                </>
              )}
            </CardContent>
          </Card>
        </Can>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Can permission={PERMISSIONS.PAYMENT_READ}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Dues</CardTitle>
            </CardHeader>
            <CardContent>
              {showAnalytics && overviewLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-xl font-semibold">
                  {overview?.pendingDues != null ? formatCurrency(overview.pendingDues) : '—'}
                </div>
              )}
            </CardContent>
          </Card>
        </Can>
        <Can permission={PERMISSIONS.PAYMENT_READ}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Overdue invoices</CardTitle>
            </CardHeader>
            <CardContent>
              {showAnalytics && overviewLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-xl font-semibold">
                  {overview?.overdueInvoices != null ? overview.overdueInvoices : '—'}
                </div>
              )}
            </CardContent>
          </Card>
        </Can>
        {showAnalytics ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href={ROUTES.ANALYTICS}>
                  Open analytics <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent activity</CardTitle>
                <CardDescription>
                  Live feed of check-ins, payments, and seat changes.
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="-mr-2">
                <Link href={showAnalytics ? ROUTES.ANALYTICS : ROUTES.REPORTS}>
                  {canAny([PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.REPORT_VIEW]) ? 'View analytics' : 'View reports'}{' '}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <RecentActivityFeed />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Common tasks for your role.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Can permission={PERMISSIONS.STUDENT_CREATE}>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href={ROUTES.STUDENTS}>
                  <Users className="h-4 w-4" /> Onboard a student
                </Link>
              </Button>
            </Can>
            <Can permission={PERMISSIONS.SHIFT_READ}>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href={ROUTES.SHIFTS}>
                  <Clock className="h-4 w-4" /> Manage shifts
                </Link>
              </Button>
            </Can>
            <Can permission={PERMISSIONS.SEAT_ASSIGN}>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href={seatGridRoute()}>
                  <Armchair className="h-4 w-4" /> Seat occupancy grid
                </Link>
              </Button>
            </Can>
            <Can permission={PERMISSIONS.PAYMENT_CREATE}>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href={ROUTES.PAYMENTS}>
                  <CreditCard className="h-4 w-4" /> Record a payment
                </Link>
              </Button>
            </Can>
            <Can permission={PERMISSIONS.ATTENDANCE_CREATE}>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link href={ROUTES.ATTENDANCE}>
                  <ClipboardCheck className="h-4 w-4" /> Mark attendance
                </Link>
              </Button>
            </Can>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
