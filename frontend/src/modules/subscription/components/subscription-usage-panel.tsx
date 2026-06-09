'use client';

import { AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { SubscriptionUsageSnapshot, UsageMetric, UsageStatus } from '@/modules/subscription/subscription-usage.types';

function capLabel(metric: UsageMetric): string {
  if (metric.unlimited || metric.limit === null) return 'Unlimited';
  return String(metric.limit);
}

function remainingLabel(metric: UsageMetric): string {
  if (metric.unlimited || metric.limit === null) return 'Unlimited capacity';
  if (metric.remaining === 0) return 'Limit reached';
  return `${metric.remaining} remaining`;
}

function barColor(status: UsageStatus): string {
  switch (status) {
    case 'OVER_LIMIT':
      return 'bg-red-600';
    case 'WARNING':
      return 'bg-amber-500';
    default:
      return 'bg-emerald-600';
  }
}

function UsageRow({
  label,
  metric,
  detail,
}: {
  label: string;
  metric: UsageMetric;
  detail?: boolean;
}) {
  const pct =
    metric.unlimited || metric.limit === null || metric.limit === 0
      ? metric.used > 0
        ? 100
        : 0
      : Math.min(100, Math.round((metric.used / metric.limit) * 100));

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {metric.used} / {capLabel(metric)}
          {metric.status === 'OVER_LIMIT' ? (
            <span className="ml-2 font-semibold text-red-600">OVER LIMIT</span>
          ) : null}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', barColor(metric.status))}
          style={{ width: `${pct}%` }}
        />
      </div>
      {detail ? (
        <p className="text-xs text-muted-foreground">
          {metric.used} used · {remainingLabel(metric)}
        </p>
      ) : null}
    </div>
  );
}

export interface SubscriptionUsagePanelProps {
  usage: SubscriptionUsageSnapshot;
  usageStatus?: string;
  showWarning?: boolean;
  detailed?: boolean;
  className?: string;
}

export function SubscriptionUsagePanel({
  usage,
  usageStatus,
  showWarning = true,
  detailed = false,
  className,
}: SubscriptionUsagePanelProps) {
  const overall = usageStatus ?? usage.usageStatus;

  return (
    <div className={cn('space-y-4', className)}>
      {showWarning && overall === 'OVER_LIMIT' ? (
        <div className="flex gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-900 dark:text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            You are over your plan limit. Upgrade your plan to continue creating new branches, seats, staff, or
            students. Existing data is unchanged.
          </p>
        </div>
      ) : null}
      {showWarning && overall === 'WARNING' ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          You are approaching your plan limits. Consider upgrading before you hit the cap.
        </div>
      ) : null}
      <UsageRow label="Seats" metric={usage.seats} detail={detailed} />
      <UsageRow label="Branches" metric={usage.branches} detail={detailed} />
      <UsageRow label="Staff" metric={usage.staff} detail={detailed} />
      <UsageRow label="Students" metric={usage.students} detail={detailed} />
    </div>
  );
}
