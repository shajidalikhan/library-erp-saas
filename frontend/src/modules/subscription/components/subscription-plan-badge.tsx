'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { billingApi } from '@/modules/billing/billing.service';
import { platformApi } from '@/modules/platform/platform.service';
import { subscriptionQueryKeys } from '@/modules/subscription/subscription-query-keys';
import type { LibrarySubscriptionSummary } from '@/modules/library/types';
import { selectUser, useAuthStore } from '@/store/auth.store';
import { ROLES } from '@/constants/permissions';

import {
  SubscriptionDetailDialog,
  type BillingSnapshot,
} from '@/modules/subscription/components/subscription-detail-dialog';

function badgeTone(expiryState: string): string {
  switch (expiryState) {
    case 'ACTIVE':
      return 'border-emerald-600/40 bg-emerald-600/10 text-emerald-800';
    case 'TRIAL':
      return 'border-blue-600/40 bg-blue-600/10 text-blue-800';
    case 'EXPIRING_SOON':
      return 'border-orange-500/50 bg-orange-500/10 text-orange-900';
    case 'GRACE_PERIOD':
      return 'border-amber-600/45 bg-amber-500/12 text-amber-950';
    case 'EXPIRED':
    case 'OVERDUE':
      return 'border-orange-600/45 bg-orange-600/12 text-orange-900';
    case 'SUSPENDED':
      return 'border-red-600/45 bg-red-600/12 text-red-900';
    case 'CANCELLED':
      return 'border-muted-foreground/30 bg-muted text-muted-foreground';
    default:
      return 'border-border bg-muted/40 text-foreground';
  }
}

export interface SubscriptionPlanBadgeProps {
  libraryId: string;
  planCode: string;
  prefetchedSnapshot?: BillingSnapshot | null;
  prefetchedSubscription?: LibrarySubscriptionSummary | null;
  className?: string;
}

export function SubscriptionPlanBadge({
  libraryId,
  planCode,
  prefetchedSnapshot,
  prefetchedSubscription,
  className,
}: SubscriptionPlanBadgeProps) {
  const user = useAuthStore(selectUser);
  const [open, setOpen] = useState(false);

  const ownerEligible = user?.role === ROLES.LIBRARY_OWNER && user.libraryId === libraryId;
  const platformEligible = user?.role === ROLES.SUPER_ADMIN;
  const interactive = ownerEligible || platformEligible;

  const q = useQuery({
    queryKey: ownerEligible
      ? subscriptionQueryKeys.ownerSnapshot(libraryId)
      : subscriptionQueryKeys.librarySnapshot(libraryId),
    enabled: open && interactive,
    staleTime: 0,
    queryFn: async () => {
      if (ownerEligible) return (await billingApi.subscriptionSnapshot()) as BillingSnapshot;
      return (await platformApi.subscriptionSnapshot(libraryId)) as BillingSnapshot;
    },
  });

  const snapshot = (q.data ?? prefetchedSnapshot) as BillingSnapshot | undefined;
  const sub = (snapshot?.subscription ?? prefetchedSubscription) as LibrarySubscriptionSummary | undefined;
  const expiryState = String(
    sub?.expiryState ?? snapshot?.expiryState ?? snapshot?.uiStatus ?? '',
  );
  const planMeta = snapshot?.plan as { displayName?: string; code?: string } | undefined;
  const resolvedPlanCode = planMeta?.code ?? sub?.planCode ?? planCode;
  const label =
    sub?.badgeLabel ??
    (snapshot?.badgeLabel as string | undefined) ??
    planMeta?.displayName ??
    sub?.planName ??
    resolvedPlanCode;
  const loading = open && q.isFetching && q.data == null;

  const tooltipPreview = sub?.warningMessage
    ? sub.warningMessage
    : label;

  if (!interactive) {
    return (
      <span
        className={cn(
          'inline-flex max-w-[220px] items-center rounded-md border px-2 py-0.5 text-xs font-semibold leading-snug',
          badgeTone(expiryState),
          className,
        )}
      >
        <span className="truncate">{label}</span>
      </span>
    );
  }

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'h-auto max-w-[240px] rounded-md border px-2 py-0.5 text-xs font-semibold leading-snug hover:bg-transparent',
                badgeTone(expiryState),
                className,
              )}
              onClick={() => setOpen(true)}
            >
              <span className="truncate">{label}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            {tooltipPreview}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <SubscriptionDetailDialog
        open={open}
        onOpenChange={setOpen}
        libraryId={libraryId}
        planCode={resolvedPlanCode}
        snapshot={snapshot ?? undefined}
        subscription={sub ?? undefined}
        isLoading={Boolean(loading)}
        viewerRole={user?.role}
      />
    </>
  );
}
