'use client';

import type { ComponentProps, ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PLAN_LIMIT_TOOLTIPS } from '@/modules/subscription/plan-limit-messages';
import type { PlanLimitEntity } from '@/modules/subscription/subscription-usage.types';

export interface PlanLimitButtonProps extends ComponentProps<typeof Button> {
  entity: PlanLimitEntity;
  blocked: boolean;
  children: ReactNode;
}

/** Disables create actions when plan cap is reached; shows upgrade tooltip. */
export function PlanLimitButton({
  entity,
  blocked,
  children,
  disabled,
  title,
  asChild,
  ...rest
}: PlanLimitButtonProps) {
  const isDisabled = Boolean(disabled || blocked);

  if (blocked) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button {...rest} disabled type="button">
                {children}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{PLAN_LIMIT_TOOLTIPS[entity]}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button {...rest} asChild={asChild} disabled={isDisabled} title={title}>
      {children}
    </Button>
  );
}
