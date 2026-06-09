'use client';

import { useQuery } from '@tanstack/react-query';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS } from '@/constants/permissions';
import { formatCurrency } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { analyticsApi } from '@/modules/analytics/analytics.service';
import { analyticsQueryKeys } from '@/modules/analytics/analytics-query-keys';
import { AnalyticsFiltersBar } from '@/modules/analytics/components/analytics-filters-bar';
import { useAnalyticsScope } from '@/modules/analytics/use-analytics-scope';

const COLORS = ['hsl(221 83% 53%)', 'hsl(142 76% 36%)', 'hsl(262 83% 58%)', 'hsl(32 95% 44%)', 'hsl(0 84% 60%)', 'hsl(280 65% 60%)'];

export default function AnalyticsPaymentsPage() {
  const { can, canAny } = usePermissions();
  const allowed = canAny([PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.REPORT_VIEW]) && can(PERMISSIONS.PAYMENT_READ);
  const { isSuper, libraryId, branchId, range, setLibraryId, setBranchId, setRange, params } = useAnalyticsScope();

  const q = useQuery({
    queryKey: analyticsQueryKeys.payments(params),
    queryFn: () => analyticsApi.payments(params),
    enabled: allowed,
  });

  if (!allowed) {
    return <p className="text-sm text-muted-foreground">No access to payment analytics.</p>;
  }

  const methods =
    (q.data?.methodDistribution as Array<{ method: string; amount: number; count: number }>) ?? [];
  const pieData = methods.map((m) => ({ name: m.method, value: m.amount }));

  const invStatus = (q.data?.invoiceStatusBreakdown as Array<{ status: string; count: number }>) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Payment analytics" description="Method mix, invoice status, and collection signals." />
      <AnalyticsFiltersBar
        isSuper={isSuper}
        libraryId={libraryId}
        branchId={branchId}
        range={range}
        onLibraryChange={setLibraryId}
        onBranchChange={setBranchId}
        onRangeChange={setRange}
      />
      {q.isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : q.isError ? (
        <p className="text-sm text-destructive">Failed to load payments analytics.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment methods (amount)</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoice status</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {invStatus.map((r) => (
                  <li key={r.status} className="flex justify-between border-b py-1">
                    <span>{r.status}</span>
                    <span className="font-medium">{r.count}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                Collection efficiency: {String(q.data?.collectionEfficiencyPct ?? '—')}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
