'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PublicLibraryProfile } from '@/modules/bookings/types';

import {
  pickBestValuePlanId,
  planIncludesRegistration,
  plansForShift,
} from './public-visibility';
import { formatCurrency } from './utils';

type PublicPlansSectionProps = {
  profile: PublicLibraryProfile;
  shiftId: string;
  branchId: string;
  selectedPlanId: string;
  onSelectPlan: (planId: string) => void;
};

export function PublicPlansSection({
  profile,
  shiftId,
  branchId,
  selectedPlanId,
  onSelectPlan,
}: PublicPlansSectionProps) {
  const plans = plansForShift(profile, shiftId, branchId);
  const bestValueId = pickBestValuePlanId(plans);

  if (!shiftId) return null;

  if (!plans.length) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Select a plan</h2>
        <p className="text-sm text-muted-foreground">Visit the library for pricing details.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Select a plan</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a plan before choosing your seat.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {plans.map((plan) => {
          const isBest = plan._id === bestValueId && plans.length > 1;
          const selected = selectedPlanId === plan._id;
          return (
            <Card
              key={plan._id}
              className={`border-slate-200/80 dark:border-slate-800 ${selected ? 'ring-2 ring-primary/40' : ''}`}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <CardTitle className="text-base">{plan.name}</CardTitle>
                {isBest ? <Badge variant="secondary">Best value</Badge> : null}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-bold">
                  {formatCurrency(plan.amount)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    / {plan.durationDays} days
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {planIncludesRegistration(plan.type)
                    ? 'Registration included'
                    : 'Study plan only (registration may apply at library)'}
                </p>
                <Button
                  type="button"
                  variant={selected ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => onSelectPlan(plan._id)}
                >
                  {selected ? 'Plan selected' : 'Select plan'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
