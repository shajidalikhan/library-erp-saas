'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ROUTES } from '@/constants/routes';
import { platformApi } from '@/modules/platform/platform.service';
import { platformQueryKeys } from '@/modules/platform/platform-query-keys';
import { SubscriptionPlanBadge } from '@/modules/subscription/components/subscription-plan-badge';
import { useSubscriptionUsage } from '@/modules/subscription/hooks/use-subscription-usage';
import { useSubscriptionFeatures } from '@/modules/subscription/hooks/use-subscription-features';
import { SubscriptionUsagePanel } from '@/modules/subscription/components/subscription-usage-panel';
import { TenantFeatureOverridesPanel } from '@/modules/platform/components/tenant-feature-overrides-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function PlatformTenantDetailPage() {
  const params = useParams<{ libraryId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const libraryId = params.libraryId ?? '';
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reason, setReason] = useState('');

  const q = useQuery({
    queryKey: platformQueryKeys.tenant(libraryId),
    queryFn: () => platformApi.tenant(libraryId),
    enabled: Boolean(libraryId),
  });

  const suspendM = useMutation({
    mutationFn: () => platformApi.suspendTenant(libraryId, { reason: reason.trim() }),
    onSuccess: () => {
      toast.success('Tenant suspended');
      setSuspendOpen(false);
      void qc.invalidateQueries({ queryKey: platformQueryKeys.all });
    },
    onError: () => toast.error('Suspend failed'),
  });

  const activateM = useMutation({
    mutationFn: () => platformApi.activateTenant(libraryId),
    onSuccess: () => {
      toast.success('Tenant activated');
      void qc.invalidateQueries({ queryKey: platformQueryKeys.all });
    },
    onError: () => toast.error('Activate failed'),
  });

  const { usage: planUsage, usageStatus, isLoading: planUsageLoading } = useSubscriptionUsage(libraryId);
  const { featureAccess } = useSubscriptionFeatures(libraryId);

  const lib = q.data?.library as Record<string, unknown> | undefined;
  const usage = q.data?.usage as Record<string, number> | undefined;
  const billingSnapshot = q.data?.billingSnapshot as Record<string, unknown> | undefined;
  const planMeta = billingSnapshot?.plan as { code?: string } | undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={ROUTES.PLATFORM_TENANTS}>← Tenants</Link>
        </Button>
      </div>
      <PageHeader title={(lib?.name as string) ?? 'Tenant'} description="Usage snapshot and lifecycle actions." />

      {q.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : q.isError ? (
        <p className="text-sm text-destructive">Could not load tenant.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{String(lib?.status)}</Badge>
            <SubscriptionPlanBadge
              libraryId={libraryId}
              planCode={String(planMeta?.code ?? lib?.subscriptionPlan ?? '')}
              prefetchedSnapshot={billingSnapshot}
              prefetchedSubscription={
                billingSnapshot?.subscription as import('@/modules/library/types').LibrarySubscriptionSummary
              }
            />
            <span className="text-sm text-muted-foreground">{String(lib?.email)}</span>
            {usageStatus === 'OVER_LIMIT' ? (
              <Badge variant="destructive">Plan over limit</Badge>
            ) : usageStatus === 'WARNING' ? (
              <Badge className="border-amber-500/50 bg-amber-500/15 text-amber-950">Plan warning</Badge>
            ) : null}
          </div>
          {planUsage ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Subscription usage</CardTitle>
                <CardDescription>Live usage vs plan caps for this tenant.</CardDescription>
              </CardHeader>
              <CardContent>
                {planUsageLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : (
                  <SubscriptionUsagePanel usage={planUsage} usageStatus={usageStatus} detailed />
                )}
              </CardContent>
            </Card>
          ) : null}
          <TenantFeatureOverridesPanel
            libraryId={libraryId}
            featureAccess={
              (featureAccess as {
                planFeatures?: Record<string, boolean>;
                enabledFeaturesOverride?: string[];
                disabledFeaturesOverride?: string[];
              }) ?? null
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {['branches', 'students', 'seats', 'staff', 'invoicesOpen', 'payments30dCount', 'payments30dAmount'].map(
              (k) => (
                <div key={k} className="rounded-lg border p-4">
                  <p className="text-xs uppercase text-muted-foreground">{k}</p>
                  <p className="text-2xl font-semibold">{usage?.[k] ?? 0}</p>
                </div>
              ),
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" onClick={() => setSuspendOpen(true)}>
              Suspend
            </Button>
            <Button variant="outline" disabled={activateM.isPending} onClick={() => activateM.mutate()}>
              Activate
            </Button>
            <Button variant="outline" onClick={() => router.push(ROUTES.PLATFORM_AUDIT)}>
              View audit trail
            </Button>
          </div>
        </>
      )}

      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend tenant</DialogTitle>
            <DialogDescription>Users in this library will be blocked until reactivated.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reason">Reason</Label>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={reason.trim().length < 3 || suspendM.isPending}
              onClick={() => suspendM.mutate()}
            >
              Confirm suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
