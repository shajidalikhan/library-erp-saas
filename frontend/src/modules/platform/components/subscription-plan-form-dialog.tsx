'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormMessage } from '@/components/ui/form-message';
import { ApiError } from '@/lib/api-error';
import { platformApi } from '@/modules/platform/platform.service';
import { platformQueryKeys } from '@/modules/platform/platform-query-keys';
import { buildSubscriptionPlanPatchBody } from '@/modules/platform/subscription-plan-payload';
import { invalidateSubscriptionQueries } from '@/modules/subscription/subscription-invalidate';
import { SUBSCRIPTION_FEATURE_KEYS } from '@/modules/subscription/subscription-feature-catalog';
import { SubscriptionPlanFeaturesEditor } from '@/modules/platform/components/subscription-plan-features-editor';
import {
  defaultFeatureFlagsFormValues,
  storedFeatureFlagsToFormValues,
  subscriptionPlanCreateFormSchema,
  subscriptionPlanEditFormSchema,
  type SubscriptionPlanCreateFormValues,
  type SubscriptionPlanEditFormValues,
} from '@/modules/platform/subscription-plan-form.schema';
import { displayNameToPlanKey, formatPlanCode } from '@/modules/platform/subscription-plan-key.util';

type PlanRow = Record<string, unknown>;

type FormValues = SubscriptionPlanCreateFormValues | SubscriptionPlanEditFormValues;

function createEmptyCreateValues(): SubscriptionPlanCreateFormValues {
  return {
    planKey: '',
    displayName: '',
    description: '',
    perfectFor: '',
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: 'INR',
    maxStudents: 50,
    maxBranches: 1,
    maxSeats: 50,
    maxStaff: 5,
    storageLimitMb: 1024,
    active: true,
    mostPopular: false,
    publicVisible: true,
    trialDays: 14,
    sortOrder: 99,
    featureFlags: defaultFeatureFlagsFormValues(),
  };
}

function planToEditValues(plan: PlanRow): SubscriptionPlanEditFormValues {
  return {
    planKey: formatPlanCode(plan.planKey as string | undefined),
    displayName: String(plan.displayName ?? ''),
    description: String(plan.description ?? ''),
    perfectFor: String(plan.perfectFor ?? ''),
    monthlyPrice: Number(plan.monthlyPrice ?? 0),
    yearlyPrice: Number(plan.yearlyPrice ?? 0),
    currency: String(plan.currency ?? 'INR'),
    maxStudents: Number(plan.maxStudents ?? 0),
    maxBranches: Number(plan.maxBranches ?? 0),
    maxSeats: Number(plan.maxSeats ?? 0),
    maxStaff: Number(plan.maxStaff ?? 0),
    storageLimitMb: Number(plan.storageLimitMb ?? 0),
    active: plan.active !== false,
    mostPopular: Boolean(plan.mostPopular ?? false),
    publicVisible: plan.publicVisible !== false,
    trialDays: Number(plan.trialDays ?? 14),
    sortOrder: Number(plan.sortOrder ?? 0),
    featureFlags: storedFeatureFlagsToFormValues(plan.featureFlags as Record<string, unknown> | undefined),
  };
}

function resolvePlanId(plan: PlanRow | null | undefined): string {
  if (!plan) return '';
  const raw = plan._id ?? plan.id;
  return raw != null ? String(raw) : '';
}

interface SubscriptionPlanFormDialogProps {
  mode: 'create' | 'edit';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: PlanRow | null;
  librariesUsingPlan?: number;
}

export function SubscriptionPlanFormDialog({
  mode,
  open,
  onOpenChange,
  plan,
  librariesUsingPlan = 0,
}: SubscriptionPlanFormDialogProps) {
  const qc = useQueryClient();
  const schema = useMemo(
    () => (mode === 'create' ? subscriptionPlanCreateFormSchema : subscriptionPlanEditFormSchema),
    [mode],
  );

  const planId = resolvePlanId(plan);

  const { data: freshPlan, isFetching: loadingPlan } = useQuery({
    queryKey: platformQueryKeys.plan(planId),
    queryFn: () => platformApi.plan(planId),
    enabled: open && mode === 'edit' && Boolean(planId),
    staleTime: 0,
  });

  const catalogKeySet = useMemo(() => new Set<string>(SUBSCRIPTION_FEATURE_KEYS), []);

  const legacyFlagKeys = useMemo(() => {
    const source = (freshPlan ?? plan)?.featureFlags;
    if (!source || typeof source !== 'object') return [];
    const raw = source as Record<string, unknown>;
    return Object.keys(raw).filter((k) => !catalogKeySet.has(k));
  }, [freshPlan, plan, catalogKeySet]);

  const [planKeyTouched, setPlanKeyTouched] = useState(false);
  const [confirmCodeChange, setConfirmCodeChange] = useState(false);
  const [pendingEditValues, setPendingEditValues] = useState<SubscriptionPlanEditFormValues | null>(null);

  const planSource = (freshPlan ?? plan) as PlanRow | null | undefined;

  const originalPlanKey = useMemo(
    () => formatPlanCode(planSource?.planKey as string | undefined),
    [planSource?.planKey],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: createEmptyCreateValues(),
  });

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit') {
      const source = freshPlan ?? plan;
      if (source) {
        form.reset(planToEditValues(source));
      }
    } else if (mode === 'create') {
      setPlanKeyTouched(false);
      form.reset(createEmptyCreateValues());
    }
  }, [open, mode, planId, freshPlan, plan, form]);

  useEffect(() => {
    if (!open || mode !== 'create') return;
    const subscription = form.watch((values, { name, type }) => {
      if (name === 'planKey' && type === 'change') {
        setPlanKeyTouched(true);
      }
      if (name === 'displayName' && !planKeyTouched) {
        const suggested = displayNameToPlanKey(String(values.displayName ?? ''));
        if (suggested) {
          form.setValue('planKey', suggested, { shouldValidate: true });
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [open, mode, form, planKeyTouched]);

  const createM = useMutation({
    mutationFn: (body: SubscriptionPlanCreateFormValues) =>
      platformApi.createPlan({
        planKey: body.planKey,
        ...buildSubscriptionPlanPatchBody(body),
      }),
    onSuccess: async () => {
      toast.success('Plan created');
      onOpenChange(false);
      await invalidateSubscriptionQueries(qc);
    },
    onError: (e: unknown) => {
      const msg = e instanceof ApiError ? e.message : 'Create failed';
      toast.error(msg);
    },
  });

  const patchM = useMutation({
    mutationFn: ({ id, body }: { id: string; body: SubscriptionPlanEditFormValues }) => {
      const payload = buildSubscriptionPlanPatchBody(body);
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.debug('[subscription-plan] PATCH', id, payload);
      }
      return platformApi.patchPlan(id, payload);
    },
    onSuccess: async (updated) => {
      const id = resolvePlanId(updated as PlanRow);
      if (id) {
        qc.setQueryData(platformQueryKeys.plan(id), updated);
      }
      toast.success('Plan saved');
      onOpenChange(false);
      await invalidateSubscriptionQueries(qc);
    },
    onError: (e: unknown) => {
      const msg = e instanceof ApiError ? e.message : 'Save failed';
      toast.error(msg);
    },
  });

  const submitEdit = (values: SubscriptionPlanEditFormValues) => {
    const id = planId;
    if (!id) {
      toast.error('Plan id missing — close and reopen the editor.');
      return;
    }
    patchM.mutate({ id, body: values });
  };

  const onSubmit = (values: FormValues) => {
    if (mode === 'create') {
      createM.mutate(values as SubscriptionPlanCreateFormValues);
      return;
    }
    const editValues = values as SubscriptionPlanEditFormValues;
    const codeChanged = formatPlanCode(editValues.planKey) !== originalPlanKey;
    const libsInUse = Number(
      (freshPlan as PlanRow | undefined)?.librariesUsingPlan ?? librariesUsingPlan ?? 0,
    );
    if (codeChanged && libsInUse > 0) {
      setPendingEditValues(editValues);
      setConfirmCodeChange(true);
      return;
    }
    submitEdit(editValues);
  };

  const busy = createM.isPending || patchM.isPending || (mode === 'edit' && loadingPlan);
  const errs = form.formState.errors as Record<string, { message?: string } | undefined>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create subscription plan' : 'Edit subscription plan'}</DialogTitle>
          <DialogDescription>
            Limits are non-negative integers (0 allowed). Prices are amounts (≥ 0). Boolean toggles and 0 values are
            saved explicitly.
          </DialogDescription>
        </DialogHeader>
        {mode === 'edit' && loadingPlan ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading plan…
          </div>
        ) : (
          <form className="grid gap-4 py-2" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-1">
              <Label htmlFor="planKey">Plan code</Label>
              <Input
                id="planKey"
                placeholder="e.g. STARTER or STARTER_PLAN"
                className="font-mono uppercase"
                {...form.register('planKey', {
                  onChange: () => {
                    if (mode === 'create') setPlanKeyTouched(true);
                  },
                })}
              />
              <p className="text-xs text-muted-foreground">
                {mode === 'edit'
                  ? 'Changing the plan code may affect existing libraries using this plan. Historical invoices keep their original code.'
                  : 'Internal SKU (uppercase). Libraries and billing reference this code — not the display name.'}
              </p>
              <FormMessage>{errs.planKey?.message}</FormMessage>
            </div>

            <div className="space-y-1">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" {...form.register('displayName')} />
              <FormMessage>{errs.displayName?.message}</FormMessage>
            </div>

            <div className="space-y-1">
              <Label htmlFor="description">Description</Label>
              <Input id="description" {...form.register('description')} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="perfectFor">Perfect for</Label>
              <Input id="perfectFor" {...form.register('perfectFor')} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="monthlyPrice">Monthly price</Label>
                <Input
                  id="monthlyPrice"
                  type="number"
                  step="0.01"
                  {...form.register('monthlyPrice', { valueAsNumber: true })}
                />
                <FormMessage>{errs.monthlyPrice?.message}</FormMessage>
              </div>
              <div className="space-y-1">
                <Label htmlFor="yearlyPrice">Yearly price</Label>
                <Input
                  id="yearlyPrice"
                  type="number"
                  step="0.01"
                  {...form.register('yearlyPrice', { valueAsNumber: true })}
                />
                <FormMessage>{errs.yearlyPrice?.message}</FormMessage>
              </div>
              <div className="space-y-1">
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" {...form.register('currency')} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="trialDays">Trial days</Label>
                <Input id="trialDays" type="number" {...form.register('trialDays', { valueAsNumber: true })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(
                [
                  ['maxStudents', 'Student profiles'],
                  ['maxBranches', 'Max branches'],
                  ['maxSeats', 'Seat capacity'],
                  ['maxStaff', 'Max staff'],
                  ['storageLimitMb', 'Cloud storage (MB)'],
                  ['sortOrder', 'Sort order'],
                ] as const
              ).map(([name, label]) => (
                <div key={name} className="space-y-1">
                  <Label htmlFor={name}>{label}</Label>
                  <Input id={name} type="number" {...form.register(name, { valueAsNumber: true })} />
                  <FormMessage>{errs[name]?.message}</FormMessage>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input accent-primary"
                  checked={form.watch('active')}
                  onChange={(e) =>
                    form.setValue('active', e.target.checked, { shouldDirty: true, shouldValidate: true })
                  }
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input accent-primary"
                  checked={form.watch('mostPopular')}
                  onChange={(e) =>
                    form.setValue('mostPopular', e.target.checked, { shouldDirty: true, shouldValidate: true })
                  }
                />
                Most popular
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input accent-primary"
                  checked={form.watch('publicVisible')}
                  onChange={(e) =>
                    form.setValue('publicVisible', e.target.checked, { shouldDirty: true, shouldValidate: true })
                  }
                />
                Public pricing page
              </label>
            </div>

            <div className="space-y-2">
              <Label>Features</Label>
              {legacyFlagKeys.length > 0 ? (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
                  Legacy keys on this plan (removed on save):{' '}
                  <span className="font-mono">{legacyFlagKeys.join(', ')}</span>
                </p>
              ) : null}
              <SubscriptionPlanFeaturesEditor
                values={form.watch('featureFlags')}
                setValue={(key, value) => {
                  form.setValue(`featureFlags.${key}`, value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>

      <Dialog open={confirmCodeChange} onOpenChange={setConfirmCodeChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change plan code?</DialogTitle>
            <DialogDescription>
              This plan is assigned to{' '}
              <span className="font-medium text-foreground">
                {Number(
                  (freshPlan as PlanRow | undefined)?.librariesUsingPlan ?? librariesUsingPlan ?? 0,
                )}{' '}
                librar
                {Number(
                  (freshPlan as PlanRow | undefined)?.librariesUsingPlan ?? librariesUsingPlan ?? 0,
                ) === 1
                  ? 'y'
                  : 'ies'}
              </span>
              . Changing the code will update future references on those libraries. Historical invoices will remain
              unchanged. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConfirmCodeChange(false);
                setPendingEditValues(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={patchM.isPending}
              onClick={() => {
                if (pendingEditValues) submitEdit(pendingEditValues);
                setConfirmCodeChange(false);
                setPendingEditValues(null);
              }}
            >
              Change code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
