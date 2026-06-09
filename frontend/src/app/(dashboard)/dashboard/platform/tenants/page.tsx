'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { platformTenantRoute } from '@/constants/routes';
import { platformApi } from '@/modules/platform/platform.service';
import { platformQueryKeys } from '@/modules/platform/platform-query-keys';
import { SubscriptionPlanBadge } from '@/modules/subscription/components/subscription-plan-badge';

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  email: string;
  status: string;
  subscriptionPlan: string;
  plan?: import('@/modules/library/types').SubscriptionPlanRef;
  subscription?: import('@/modules/library/types').LibrarySubscriptionSummary;
};

export default function PlatformTenantsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [expiryState, setExpiryState] = useState('');
  const [expiringSoon, setExpiringSoon] = useState(false);
  const params = useMemo(
    () => ({
      page: '1',
      limit: '30',
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(status ? { status } : {}),
      ...(expiryState ? { expiryState } : {}),
      ...(expiringSoon ? { expiringWithinDays: '3' } : {}),
    }),
    [search, status, expiryState, expiringSoon],
  );

  const q = useQuery({
    queryKey: platformQueryKeys.tenants(params),
    queryFn: () => platformApi.tenants(params),
  });

  const items = (q.data?.data.items ?? []) as TenantRow[];

  return (
    <div className="space-y-6">
      <PageHeader title="Tenants" description="Search, filter, and open any library workspace." />

      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search name, slug, email…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <select
          className="h-10 rounded-md border border-input bg-background px-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="TRIAL">TRIAL</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-2 text-sm"
          value={expiryState}
          onChange={(e) => setExpiryState(e.target.value)}
        >
          <option value="">All lifecycle</option>
          <option value="EXPIRING_SOON">Expiring soon</option>
          <option value="GRACE_PERIOD">Grace</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={expiringSoon} onChange={(e) => setExpiringSoon(e.target.checked)} />
          ≤3 days
        </label>
      </div>

      {q.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : q.isError ? (
        <p className="text-sm text-destructive">Could not load tenants.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Library</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Subscription</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2 text-right"> </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.slug}</p>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={t.status === 'SUSPENDED' ? 'destructive' : 'secondary'}>{t.status}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <SubscriptionPlanBadge
                      libraryId={t.id}
                      planCode={t.plan?.code ?? t.subscription?.planCode ?? t.subscriptionPlan}
                      prefetchedSnapshot={t.plan ? { plan: t.plan } : undefined}
                      prefetchedSubscription={t.subscription}
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {t.subscription?.dueAmount != null && t.subscription.dueAmount > 0
                      ? `₹${t.subscription.dueAmount}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={platformTenantRoute(t.id)}>Open</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
