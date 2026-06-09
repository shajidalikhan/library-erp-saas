'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Shield } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatCurrency } from '@/lib/utils';
import { SubscriptionPlanDeactivateDialog } from '@/modules/platform/components/subscription-plan-deactivate-dialog';
import { SubscriptionPlanFormDialog } from '@/modules/platform/components/subscription-plan-form-dialog';
import { platformApi } from '@/modules/platform/platform.service';
import { platformQueryKeys } from '@/modules/platform/platform-query-keys';
import {
  FEATURE_FLAG_OPTIONS,
  SUBSCRIPTION_PLAN_FEATURE_FLAG_KEYS,
} from '@/modules/platform/subscription-plan-feature-flags.constants';
import { formatPlanCode } from '@/modules/platform/subscription-plan-key.util';

type PlanRow = Record<string, unknown> & {
  planKey?: string;
  displayName?: string;
  active?: boolean;
  sortOrder?: number;
  librariesUsingPlan?: number;
  featureFlags?: Record<string, boolean>;
};

export default function PlatformPlansPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [deactivate, setDeactivate] = useState<PlanRow | null>(null);

  const q = useQuery({
    queryKey: platformQueryKeys.plans(),
    queryFn: () => platformApi.plans(),
  });

  const items = useMemo(() => (q.data?.items ?? []) as PlanRow[], [q.data?.items]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Subscription plans"
          description="Manage SaaS tiers: pricing, limits, feature flags, and availability."
        />
        <Button
          onClick={() => {
            setFormMode('create');
            setEditing(null);
            setFormOpen(true);
          }}
        >
          Create new plan
        </Button>
      </div>

      {q.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : q.isError ? (
        <p className="text-sm text-destructive">Could not load plans.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((p) => {
            const active = Boolean(p.active);
            const highlighted = active && Number(p.sortOrder) === 0;
            const rawFlags =
              p.featureFlags && typeof p.featureFlags === 'object'
                ? (p.featureFlags as Record<string, boolean>)
                : {};
            const catalogKeySet = new Set<string>(SUBSCRIPTION_PLAN_FEATURE_FLAG_KEYS);
            const enabledCatalog = FEATURE_FLAG_OPTIONS.filter((o) => rawFlags[o.key]);
            const legacyEnabled = Object.entries(rawFlags).filter(([k, v]) => !catalogKeySet.has(k) && v);
            const inUse = Number(p.librariesUsingPlan ?? 0);
            const planCode = formatPlanCode(p.planKey);
            const displayName = String(p.displayName ?? '').trim();

            return (
              <Card
                key={String(p._id ?? p.id)}
                className={cn(
                  'flex flex-col transition-shadow',
                  highlighted && 'ring-2 ring-primary/35 shadow-md',
                  !active && 'opacity-75',
                )}
              >
                <CardHeader className="space-y-2 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-xs tracking-wide">
                      {planCode}
                    </Badge>
                    <Badge variant={active ? 'default' : 'outline'}>{active ? 'Active' : 'Inactive'}</Badge>
                    {inUse > 0 ? (
                      <Badge variant="outline" className="text-xs">
                        {inUse} librar{inUse === 1 ? 'y' : 'ies'}
                      </Badge>
                    ) : null}
                  </div>
                  <CardTitle className="text-lg">{displayName}</CardTitle>
                  <CardDescription>
                    {planCode.toLowerCase() === displayName.toLowerCase()
                      ? 'Plan code matches display name — use a distinct marketing label or uppercase code.'
                      : `Display name for tenants · internal code ${planCode}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4 text-sm">
                  <div className="rounded-md bg-muted/40 px-3 py-2">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Pricing</p>
                    <p className="mt-1 text-base font-semibold">
                      {formatCurrency(Number(p.monthlyPrice ?? 0))}
                      <span className="text-xs font-normal text-muted-foreground"> /mo</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(Number(p.yearlyPrice ?? 0))} /yr
                    </p>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Limits</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded border bg-background/60 px-2 py-1.5">
                        <span className="text-muted-foreground">Seat capacity</span>
                        <p className="font-medium">{String(p.maxSeats)}</p>
                      </div>
                      <div className="rounded border bg-background/60 px-2 py-1.5">
                        <span className="text-muted-foreground">Branches</span>
                        <p className="font-medium">{String(p.maxBranches)}</p>
                      </div>
                      <div className="rounded border bg-background/60 px-2 py-1.5">
                        <span className="text-muted-foreground">Profiles cap</span>
                        <p className="font-medium">{String(p.maxStudents)}</p>
                      </div>
                      <div className="rounded border bg-background/60 px-2 py-1.5">
                        <span className="text-muted-foreground">Staff</span>
                        <p className="font-medium">{String(p.maxStaff)}</p>
                      </div>
                      <div className="col-span-2 rounded border bg-background/60 px-2 py-1.5">
                        <span className="text-muted-foreground">Cloud storage</span>
                        <p className="font-medium">
                          {(() => {
                            const mb = Number(p.storageLimitMb ?? 0);
                            if (mb >= 1024 && mb % 1024 === 0) {
                              return `${mb === 1024 ? '1' : mb / 1024} GB optimized cloud storage`;
                            }
                            return `${mb} MB optimized cloud storage`;
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Features</p>
                    {enabledCatalog.length === 0 && legacyEnabled.length === 0 ? (
                      <p className="text-xs text-muted-foreground">None enabled.</p>
                    ) : (
                      <ul className="flex flex-wrap gap-1.5">
                        {enabledCatalog.slice(0, 10).map((o) => (
                          <li
                            key={o.key}
                            className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary"
                          >
                            {o.label}
                          </li>
                        ))}
                        {legacyEnabled.slice(0, 4).map(([k]) => (
                          <li
                            key={k}
                            className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-200"
                          >
                            Legacy: <span className="font-mono">{k}</span>
                          </li>
                        ))}
                        {enabledCatalog.length > 10 ? (
                          <li className="text-xs text-muted-foreground">+{enabledCatalog.length - 10} more</li>
                        ) : null}
                      </ul>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2 border-t pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormMode('edit');
                      setEditing(p);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  {active ? (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeactivate(p)}>
                      Deactivate
                    </Button>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Shield className="h-3 w-3" />
                      Soft-disabled
                    </span>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <SubscriptionPlanFormDialog
        mode={formMode}
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) setEditing(null);
        }}
        plan={formMode === 'edit' ? editing : null}
        librariesUsingPlan={
          formMode === 'edit' && editing ? Number(editing.librariesUsingPlan ?? 0) : 0
        }
      />

      <SubscriptionPlanDeactivateDialog
        open={Boolean(deactivate)}
        onOpenChange={(o) => !o && setDeactivate(null)}
        planId={deactivate ? String(deactivate._id ?? deactivate.id) : null}
        planName={deactivate ? String(deactivate.displayName) : ''}
        librariesUsingPlan={deactivate ? Number(deactivate.librariesUsingPlan ?? 0) : 0}
      />
    </div>
  );
}
