'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { platformApi } from '@/modules/platform/platform.service';
import { platformQueryKeys } from '@/modules/platform/platform-query-keys';

export default function PlatformUsagePage() {
  const q = useQuery({
    queryKey: platformQueryKeys.usage(),
    queryFn: () => platformApi.usage(),
  });

  const snap = useQuery({
    queryKey: [...platformQueryKeys.usage(), 'snap'],
    queryFn: () => platformApi.snapshots(),
    enabled: false,
  });

  const data = q.data as
    | {
        paymentTrendLast30d?: { _id: string; total: number }[];
        topLibrariesByStudents?: { name: string; students: number }[];
      }
    | undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usage analytics"
        description="Cross-tenant payment velocity and top libraries by enrollment."
      />
      <Button
        variant="outline"
        size="sm"
        disabled={snap.isFetching}
        onClick={() => {
          void snap.refetch();
        }}
      >
        Record usage snapshots
      </Button>
      {snap.isSuccess ? (
        <p className="text-xs text-muted-foreground">
          Processed {snap.data.librariesProcessed} libraries at {snap.data.snapshotAt}
        </p>
      ) : null}

      {q.isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : q.isError ? (
        <p className="text-sm text-destructive">Could not load usage.</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="h-72 rounded-lg border p-4">
            <p className="mb-4 text-sm font-medium">Payments (30d)</p>
            <ResponsiveContainer width="100%" height="85%">
              <AreaChart data={data?.paymentTrendLast30d ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="mb-3 text-sm font-medium">Top libraries by students</p>
            <ul className="divide-y rounded-lg border text-sm">
              {(data?.topLibrariesByStudents ?? []).map((row) => (
                <li key={row.name} className="flex justify-between px-3 py-2">
                  <span>{row.name}</span>
                  <span className="text-muted-foreground">{row.students}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
