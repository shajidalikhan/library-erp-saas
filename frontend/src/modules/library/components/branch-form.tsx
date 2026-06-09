'use client';

import { useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormMessage } from '@/components/ui/form-message';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { BranchLogoUploadCard } from '@/components/upload/branch-logo-upload-card';
import { mediaAssetFromField, type MediaAsset } from '@/lib/media-url';

import { branchFormSchema, type BranchFormValues } from '../library.validation';
import type { Branch } from '../types';

function branchToDefaults(b: Branch): BranchFormValues {
  return {
    branchName: b.branchName,
    branchCode: b.branchCode,
    managerId: b.managerId ?? '',
    email: b.email,
    phone: b.phone ?? '',
    address: b.address ?? '',
    city: b.city ?? '',
    state: b.state ?? '',
    pincode: b.pincode ?? '',
    totalSeats: b.totalSeats,
    active: b.active,
  };
}

const empty: BranchFormValues = {
  branchName: '',
  branchCode: '',
  managerId: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  totalSeats: 0,
  active: true,
};

export interface BranchFormProps {
  mode: 'create' | 'edit';
  initial?: Branch | null;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  submitLabel?: string;
}

function buildPayload(values: BranchFormValues, logo: MediaAsset | null): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    branchName: values.branchName.trim(),
    branchCode: values.branchCode.trim().toUpperCase(),
    email: values.email.trim(),
    totalSeats: values.totalSeats,
    active: values.active,
  };
  const m = values.managerId?.trim();
  if (m) payload.managerId = m;
  const opt = (k: keyof BranchFormValues) => {
    const v = values[k];
    if (typeof v === 'string' && v.trim() !== '') payload[k as string] = v.trim();
  };
  opt('phone');
  opt('address');
  opt('city');
  opt('state');
  opt('pincode');
  if (logo) payload.logo = logo;
  return payload;
}

export function BranchForm({ mode, initial, onSubmit, submitLabel }: BranchFormProps) {
  const defaults = initial ? branchToDefaults(initial) : empty;
  const [logoAsset, setLogoAsset] = useState<MediaAsset | null>(() =>
    initial ? mediaAssetFromField(initial.logo) : null,
  );
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema) as Resolver<BranchFormValues>,
    defaultValues: defaults,
  });

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(buildPayload(values, logoAsset));
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
          <CardTitle className="text-lg">Branch profile</CardTitle>
          <CardDescription>Operational identity for this location.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <BranchLogoUploadCard value={logoAsset} onChange={setLogoAsset} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="branchName">Branch name</Label>
            <Input id="branchName" hasError={!!errors.branchName} {...register('branchName')} />
            <FormMessage>{errors.branchName?.message}</FormMessage>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="branchCode">Branch code</Label>
            <Input
              id="branchCode"
              disabled={mode === 'edit'}
              className={mode === 'edit' ? 'opacity-70' : ''}
              {...register('branchCode')}
            />
            <FormMessage>{errors.branchCode?.message}</FormMessage>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="managerId">Manager user ID</Label>
            <Input id="managerId" placeholder="Optional" {...register('managerId')} />
            <FormMessage>{errors.managerId?.message}</FormMessage>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Branch email</Label>
            <Input id="email" type="email" hasError={!!errors.email} {...register('email')} />
            <FormMessage>{errors.email?.message}</FormMessage>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...register('phone')} />
            <FormMessage>{errors.phone?.message}</FormMessage>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="totalSeats">Total seats</Label>
            <Input id="totalSeats" type="number" min={0} {...register('totalSeats')} />
            <FormMessage>{errors.totalSeats?.message}</FormMessage>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input id="active" type="checkbox" className="h-4 w-4 rounded border-input" {...register('active')} />
            <Label htmlFor="active" className="cursor-pointer font-normal">
              Branch is active
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Address</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">Street address</Label>
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
            <Label htmlFor="pincode">Pincode</Label>
            <Input id="pincode" {...register('pincode')} />
            <FormMessage>{errors.pincode?.message}</FormMessage>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            (submitLabel ?? (mode === 'create' ? 'Create branch' : 'Save branch'))
          )}
        </Button>
      </div>
    </form>
  );
}
