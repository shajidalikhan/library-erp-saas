'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api-error';
import { platformApi } from '@/modules/platform/platform.service';
import { platformQueryKeys } from '@/modules/platform/platform-query-keys';
import { SUBSCRIPTION_FEATURE_CATALOG } from '@/modules/subscription/subscription-feature-catalog';
import { invalidateSubscriptionQueries } from '@/modules/subscription/subscription-invalidate';

type FeatureAccess = {
  planFeatures?: Record<string, boolean>;
  features?: Record<string, boolean>;
  enabledFeaturesOverride?: string[];
  disabledFeaturesOverride?: string[];
};

export function TenantFeatureOverridesPanel({
  libraryId,
  featureAccess,
}: {
  libraryId: string;
  featureAccess?: FeatureAccess | null;
}) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState<string[]>([]);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [reason, setReason] = useState('');

  useEffect(() => {
    setEnabled(featureAccess?.enabledFeaturesOverride ?? []);
    setDisabled(featureAccess?.disabledFeaturesOverride ?? []);
  }, [featureAccess]);

  const saveM = useMutation({
    mutationFn: () =>
      platformApi.patchTenantFeatureOverrides(libraryId, {
        enabledFeaturesOverride: enabled,
        disabledFeaturesOverride: disabled,
        reason: reason.trim(),
      }),
    onSuccess: async () => {
      toast.success('Feature overrides saved', {
        description:
          'Feature updated. Tenant users may need to refresh the page or sign in again to see changes.',
      });
      setReason('');
      await invalidateSubscriptionQueries(qc, libraryId);
      void qc.invalidateQueries({ queryKey: platformQueryKeys.tenant(libraryId) });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Save failed'),
  });

  const toggle = (key: string, list: 'enabled' | 'disabled') => {
    if (list === 'enabled') {
      setEnabled((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
      setDisabled((prev) => prev.filter((k) => k !== key));
    } else {
      setDisabled((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
      setEnabled((prev) => prev.filter((k) => k !== key));
    }
  };

  const planFeatures = featureAccess?.planFeatures ?? featureAccess?.features ?? {};

  const featureStateLabel = (key: string) => {
    const onPlan = Boolean(planFeatures[key]);
    const forceOn = enabled.includes(key);
    const forceOff = disabled.includes(key);
    if (forceOn) return { text: 'Enabled by override', className: 'text-blue-600 dark:text-blue-400' };
    if (forceOff) return { text: 'Disabled by override', className: 'text-orange-600 dark:text-orange-400' };
    if (onPlan) return { text: 'Included by plan', className: 'text-green-600 dark:text-green-400' };
    return { text: 'Not included', className: 'text-red-600 dark:text-red-400' };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Feature overrides</CardTitle>
        <CardDescription>
          Grant or revoke features for this tenant beyond their plan. Changes are audited.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3 text-sm">
          {SUBSCRIPTION_FEATURE_CATALOG.map((f) => {
            const state = featureStateLabel(f.key);
            const forceOn = enabled.includes(f.key);
            const forceOff = disabled.includes(f.key);
            return (
              <div key={f.key} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0">
                <div>
                  <p className="font-medium">{f.label}</p>
                  <p className={`text-xs font-medium ${state.className}`}>{state.text}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={forceOn ? 'default' : 'outline'}
                    onClick={() => toggle(f.key, 'enabled')}
                  >
                    Enable
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={forceOff ? 'destructive' : 'outline'}
                    onClick={() => toggle(f.key, 'disabled')}
                  >
                    Disable
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="space-y-2">
          <Label htmlFor="override-reason">Reason (required)</Label>
          <textarea
            id="override-reason"
            className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are overrides being applied?"
          />
        </div>
        <Button
          type="button"
          disabled={saveM.isPending || reason.trim().length < 3}
          onClick={() => saveM.mutate()}
        >
          Save overrides
        </Button>
      </CardContent>
    </Card>
  );
}
