'use client';

import { cn } from '@/lib/utils';

const STEPS = [
  { id: 'branch', label: 'Branch' },
  { id: 'shift', label: 'Shift' },
  { id: 'plan', label: 'Plan' },
  { id: 'seat', label: 'Seat' },
  { id: 'details', label: 'Details' },
  { id: 'reserve', label: 'Reserve' },
] as const;

export type PublicBookingStepId = (typeof STEPS)[number]['id'];

type PublicBookingStepsProps = {
  activeStep: PublicBookingStepId;
  className?: string;
};

function stepIndex(step: PublicBookingStepId): number {
  return STEPS.findIndex((s) => s.id === step);
}

export function PublicBookingSteps({ activeStep, className }: PublicBookingStepsProps) {
  const activeIdx = stepIndex(activeStep);

  return (
    <nav aria-label="Booking progress" className={cn('space-y-2', className)}>
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((step, index) => {
          const done = index < activeIdx;
          const current = index === activeIdx;
          return (
            <li
              key={step.id}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium',
                done && 'border-primary/30 bg-primary/10 text-primary',
                current && 'border-primary bg-primary text-primary-foreground',
                !done && !current && 'border-muted-foreground/20 text-muted-foreground',
              )}
            >
              <span className="tabular-nums">{index + 1}.</span> {step.label}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function resolveActiveBookingStep(input: {
  branchId: string;
  shiftId: string;
  feePlanId: string;
  seatId: string;
  hasSubmitted: boolean;
}): PublicBookingStepId {
  if (input.hasSubmitted) return 'reserve';
  if (!input.branchId) return 'branch';
  if (!input.shiftId) return 'shift';
  if (!input.feePlanId) return 'plan';
  if (!input.seatId) return 'seat';
  return 'details';
}
