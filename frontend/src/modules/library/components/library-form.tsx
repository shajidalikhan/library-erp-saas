'use client';

import { useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormMessage } from '@/components/ui/form-message';
import { LogoUploadCard } from '@/components/upload/logo-upload-card';
import { mediaAssetFromField } from '@/lib/media-url';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { usePlatformCatalogPlans } from '@/modules/platform/hooks/use-platform-catalog-plans';

import { libraryFormSchema, type LibraryFormValues } from '../library.validation';
import type { Library } from '../types';

function libraryToFormDefaults(lib: Library): LibraryFormValues {
  return {
    name: lib.name,
    slug: lib.slug,
    ownerId: lib.ownerId ?? '',
    email: lib.email,
    phone: lib.phone ?? '',
    gstNumber: lib.gstNumber ?? '',
    address: lib.address ?? '',
    city: lib.city ?? '',
    state: lib.state ?? '',
    country: lib.country ?? '',
    pincode: lib.pincode ?? '',
    timezone: lib.timezone ?? '',
    subscriptionPlan: lib.subscriptionPlan,
    status: lib.status,
    settingsJson: lib.settings && Object.keys(lib.settings).length > 0 ? JSON.stringify(lib.settings, null, 2) : '',
  };
}

const emptyDefaults: LibraryFormValues = {
  name: '',
  slug: '',
  ownerId: '',
  email: '',
  phone: '',
  gstNumber: '',
  address: '',
  city: '',
  state: '',
  country: '',
  pincode: '',
  timezone: 'Asia/Kolkata',
  subscriptionPlan: 'BASIC',
  status: 'TRIAL',
  settingsJson: '',
  planType: 'TRIAL',
  billingCycle: 'TRIAL',
  subscriptionStartDate: new Date().toISOString().slice(0, 10),
  subscriptionEndDate: '',
  trialDays: 14,
  createInvoice: false,
  invoiceDueDate: '',
  paidAmount: undefined,
  invoiceAmount: undefined,
};

export interface LibrarySubmitOptions {
  logoFile?: File;
}

export interface LibraryFormProps {
  mode: 'create' | 'edit';
  initial?: Library | null;
  showOwnerField: boolean;
  showSlugField: boolean;
  showPlanAndStatus?: boolean;
  /** Required SaaS assignment step when creating a library (super admin). */
  showSubscriptionAssign?: boolean;
  showSettingsJson?: boolean;
  onSubmit: (
    payload: Record<string, unknown>,
    submitOptions?: LibrarySubmitOptions,
  ) => Promise<void>;
  submitLabel?: string;
}

function buildPayload(
  values: LibraryFormValues,
  mode: 'create' | 'edit',
  options: {
    showPlanAndStatus: boolean;
    showOwnerField: boolean;
    showSlugField: boolean;
    showSettingsJson: boolean;
    showSubscriptionAssign: boolean;
  },
): Record<string, unknown> {
  const { showPlanAndStatus, showOwnerField, showSlugField, showSettingsJson, showSubscriptionAssign } =
    options;
  const payload: Record<string, unknown> = {
    name: values.name.trim(),
    email: values.email.trim(),
  };

  if (showPlanAndStatus) {
    payload.subscriptionPlan = values.subscriptionPlan;
    payload.status = values.status;
  }

  const optionalString = (key: keyof LibraryFormValues) => {
    const v = values[key];
    if (typeof v === 'string' && v.trim() !== '') payload[key as string] = v.trim();
  };

  optionalString('phone');
  optionalString('gstNumber');
  optionalString('address');
  optionalString('city');
  optionalString('state');
  optionalString('country');
  optionalString('pincode');
  optionalString('timezone');

  if (showSlugField) {
    const slug = values.slug?.trim();
    if (slug) payload.slug = slug.toLowerCase();
  }

  if (showOwnerField) {
    const owner = values.ownerId?.trim();
    if (owner) payload.ownerId = owner;
  }

  if (showSubscriptionAssign && mode === 'create') {
    const planType = values.planType ?? 'TRIAL';
    const billingCycle = values.billingCycle ?? 'TRIAL';
    if (!values.subscriptionStartDate?.trim()) {
      throw new Error('Subscription start date is required');
    }
    payload.subscription = {
      planType,
      billingCycle,
      subscriptionStartDate: new Date(values.subscriptionStartDate).toISOString(),
      ...(values.subscriptionEndDate?.trim()
        ? { subscriptionEndDate: new Date(values.subscriptionEndDate).toISOString() }
        : {}),
      ...(planType === 'TRIAL' || billingCycle === 'TRIAL'
        ? { trialDays: values.trialDays ?? 14 }
        : {}),
      ...(values.createInvoice
        ? {
            createInvoice: true,
            invoiceDueDate: values.invoiceDueDate
              ? new Date(values.invoiceDueDate).toISOString()
              : new Date(values.subscriptionStartDate).toISOString(),
            ...(values.paidAmount != null ? { paidAmount: values.paidAmount } : {}),
            ...(values.invoiceAmount != null ? { amount: values.invoiceAmount } : {}),
          }
        : { createInvoice: false }),
    };
  }

  if (showSettingsJson) {
    if (values.settingsJson?.trim()) {
      try {
        payload.settings = JSON.parse(values.settingsJson) as Record<string, unknown>;
      } catch {
        throw new Error('Settings must be valid JSON');
      }
    } else if (mode === 'create') {
      payload.settings = {};
    }
  }

  return payload;
}

export function LibraryForm({
  mode,
  initial,
  showOwnerField,
  showSlugField,
  showPlanAndStatus = true,
  showSubscriptionAssign = false,
  showSettingsJson = true,
  onSubmit,
  submitLabel,
}: LibraryFormProps) {
  const needsCatalogPlans = showSubscriptionAssign || showPlanAndStatus;
  const { data: catalogPlans = [] } = usePlatformCatalogPlans({ activeOnly: true });

  const defaults = initial ? libraryToFormDefaults(initial) : emptyDefaults;
  const initialRemoteLogo = useMemo(
    () => (initial ? mediaAssetFromField(initial.logo) : null),
    [initial],
  );
  const initialHasRemoteLogo = Boolean(initialRemoteLogo);

  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [clearedRemoteLogo, setClearedRemoteLogo] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LibraryFormValues>({
    resolver: zodResolver(libraryFormSchema) as Resolver<LibraryFormValues>,
    defaultValues: defaults,
  });

  const submit = handleSubmit(async (values) => {
    try {
      const payload = buildPayload(values, mode, {
        showPlanAndStatus,
        showOwnerField,
        showSlugField,
        showSettingsJson,
        showSubscriptionAssign,
      });

      if (pendingLogoFile) {
        await onSubmit(payload, { logoFile: pendingLogoFile });
        return;
      }

      if (mode === 'edit' && clearedRemoteLogo && initialHasRemoteLogo) {
        await onSubmit({ ...payload, logo: null });
        return;
      }

      await onSubmit(payload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unable to save';
      setError('root', { message: msg });
    }
  });

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {errors.root ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors.root.message}
        </p>
      ) : null}

      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Identity</CardTitle>
          <CardDescription>How this library appears across the platform.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name">Library name</Label>
            <Input id="name" hasError={!!errors.name} {...register('name')} />
            <FormMessage>{errors.name?.message}</FormMessage>
          </div>
          {showSlugField ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="slug">Slug (optional)</Label>
              <Input id="slug" placeholder="auto-generated from name if empty" {...register('slug')} />
              <FormMessage>{errors.slug?.message}</FormMessage>
            </div>
          ) : null}
          {showOwnerField ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ownerId">Owner user ID</Label>
              <Input id="ownerId" placeholder="Library owner user id" {...register('ownerId')} />
              <FormMessage>{errors.ownerId?.message}</FormMessage>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Contact & billing</CardTitle>
          <CardDescription>Reachable contacts and tax identifiers.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="email">Primary email</Label>
            <Input id="email" type="email" hasError={!!errors.email} {...register('email')} />
            <FormMessage>{errors.email?.message}</FormMessage>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...register('phone')} />
            <FormMessage>{errors.phone?.message}</FormMessage>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="gstNumber">GST number</Label>
            <Input id="gstNumber" {...register('gstNumber')} />
            <FormMessage>{errors.gstNumber?.message}</FormMessage>
          </div>
          <LogoUploadCard
            strategy="save-with-library"
            label="Library logo"
            remoteAsset={initialRemoteLogo}
            pendingFile={pendingLogoFile}
            onPendingFileChange={(f) => {
              setPendingLogoFile(f);
              if (f) setClearedRemoteLogo(false);
            }}
            clearedRemoteLogo={clearedRemoteLogo}
            onClearRemoteLogoChange={(c) => {
              setClearedRemoteLogo(c);
              if (c) setPendingLogoFile(null);
            }}
            libraryId={initial?._id}
          />
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Location</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" {...register('address')} />
            <FormMessage>{errors.address?.message}</FormMessage>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <Input id="city" {...register('city')} />
            <FormMessage>{errors.city?.message}</FormMessage>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">State</Label>
            <Input id="state" {...register('state')} />
            <FormMessage>{errors.state?.message}</FormMessage>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="country">Country</Label>
            <Input id="country" {...register('country')} />
            <FormMessage>{errors.country?.message}</FormMessage>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pincode">Pincode</Label>
            <Input id="pincode" {...register('pincode')} />
            <FormMessage>{errors.pincode?.message}</FormMessage>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" placeholder="Asia/Kolkata" {...register('timezone')} />
            <FormMessage>{errors.timezone?.message}</FormMessage>
          </div>
        </CardContent>
      </Card>

      {showSubscriptionAssign && mode === 'create' ? (
        <Card className="border-border/60 shadow-soft border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">SaaS subscription</CardTitle>
            <CardDescription>
              Assign plan, billing cycle, and term dates. Trial is selected by default (14 days).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="planType">Plan</Label>
              <select
                id="planType"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register('planType')}
              >
                <option value="TRIAL">Trial (uses default trial days)</option>
                {catalogPlans
                  .filter((p) => !['FREE', 'STARTER'].includes(p.planKey))
                  .map((p) => (
                    <option key={p.planKey} value={p.planKey}>
                      {p.displayName}
                      {p.monthlyPrice != null && p.monthlyPrice > 0
                        ? ` · ₹${p.monthlyPrice}/mo`
                        : ''}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billingCycle">Billing cycle</Label>
              <select
                id="billingCycle"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register('billingCycle')}
              >
                <option value="TRIAL">Trial</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subscriptionStartDate">Start date</Label>
              <Input id="subscriptionStartDate" type="date" {...register('subscriptionStartDate')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="subscriptionEndDate">End date (custom / override)</Label>
              <Input id="subscriptionEndDate" type="date" {...register('subscriptionEndDate')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trialDays">Trial days</Label>
              <Input id="trialDays" type="number" min={1} max={90} {...register('trialDays')} />
            </div>
            <div className="space-y-1.5 flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register('createInvoice')} className="rounded border-input" />
                Create subscription invoice now
              </label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoiceDueDate">Invoice due date</Label>
              <Input id="invoiceDueDate" type="date" {...register('invoiceDueDate')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoiceAmount">Invoice amount override</Label>
              <Input id="invoiceAmount" type="number" step="0.01" {...register('invoiceAmount')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paidAmount">Initial paid amount</Label>
              <Input id="paidAmount" type="number" step="0.01" {...register('paidAmount')} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showPlanAndStatus ? (
      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Plan & status</CardTitle>
          <CardDescription>Subscription tier and tenant lifecycle (platform administrators only).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="subscriptionPlan">Subscription</Label>
            <select
              id="subscriptionPlan"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register('subscriptionPlan')}
              disabled={needsCatalogPlans && catalogPlans.length === 0}
            >
              {(needsCatalogPlans ? catalogPlans : []).length === 0 ? (
                <option value={initial?.subscriptionPlan ?? 'BASIC'}>
                  {initial?.subscriptionPlan ?? 'BASIC'}
                </option>
              ) : (
                catalogPlans.map((p) => (
                  <option key={p.planKey} value={p.planKey}>
                    {p.displayName}
                    {p.mostPopular ? ' (Popular)' : ''}
                  </option>
                ))
              )}
            </select>
            <FormMessage>{errors.subscriptionPlan?.message}</FormMessage>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register('status')}
            >
              <option value="TRIAL">Trial</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
            <FormMessage>{errors.status?.message}</FormMessage>
          </div>
        </CardContent>
      </Card>
      ) : null}

      {showSettingsJson ? (
        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle className="text-lg">Settings JSON</CardTitle>
            <CardDescription>Optional structured settings stored on the library.</CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder='{"theme":"dark"}'
              {...register('settingsJson')}
            />
            <FormMessage>{errors.settingsJson?.message}</FormMessage>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            (submitLabel ?? (mode === 'create' ? 'Create library' : 'Save changes'))
          )}
        </Button>
      </div>
    </form>
  );
}
