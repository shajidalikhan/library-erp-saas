'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api-error';
import { platformApi } from '@/modules/platform/platform.service';
import { platformQueryKeys } from '@/modules/platform/platform-query-keys';
import { invalidateSubscriptionQueries } from '@/modules/subscription/subscription-invalidate';

interface SubscriptionPlanDeactivateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string | null;
  planName: string;
  librariesUsingPlan: number;
}

export function SubscriptionPlanDeactivateDialog({
  open,
  onOpenChange,
  planId,
  planName,
  librariesUsingPlan,
}: SubscriptionPlanDeactivateDialogProps) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (id: string) => platformApi.patchPlan(id, { active: false }),
    onSuccess: async () => {
      toast.success('Plan deactivated');
      onOpenChange(false);
      await invalidateSubscriptionQueries(qc);
    },
    onError: (e: unknown) => {
      const msg = e instanceof ApiError ? e.message : 'Could not deactivate';
      toast.error(msg);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deactivate plan?</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{planName}</span> will be marked inactive. Existing
            libraries keep their current plan assignment; this only hides the tier from new picks. Plans are never hard
            deleted from the catalog.
            {librariesUsingPlan > 0 ? (
              <span className="mt-2 block text-amber-700 dark:text-amber-400">
                {librariesUsingPlan} librar{librariesUsingPlan === 1 ? 'y is' : 'ies are'} still assigned to this plan
                key.
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!planId || m.isPending}
            onClick={() => planId && m.mutate(planId)}
          >
            Deactivate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
