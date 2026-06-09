'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, CheckCircle2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormMessage } from '@/components/ui/form-message';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api-error';

import { DEMO_REQUEST_FEATURES } from '../demo-request.constants';
import { demoRequestApi } from '../demo-request.service';
import { requestDemoSchema, type RequestDemoFormValues } from '../demo-request.validation';

export function RequestDemoForm() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RequestDemoFormValues>({
    resolver: zodResolver(requestDemoSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      libraryName: '',
      city: '',
      branchCount: 1,
      studentCount: 50,
      currentSystem: '',
      interestedFeatures: [],
      notes: '',
      website: '',
    },
  });

  const selectedFeatures = watch('interestedFeatures') ?? [];

  const toggleFeature = (featureId: (typeof DEMO_REQUEST_FEATURES)[number]['id']) => {
    const next = selectedFeatures.includes(featureId)
      ? selectedFeatures.filter((id) => id !== featureId)
      : [...selectedFeatures, featureId];
    setValue('interestedFeatures', next, { shouldValidate: true });
  };

  const onSubmit = async (values: RequestDemoFormValues) => {
    try {
      await demoRequestApi.create(values);
      setSubmitted(true);
      toast.success('Thanks! Our team will contact you shortly.');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Something went wrong, please try again');
      }
    }
  };

  if (submitted) {
    return (
      <div className="space-y-6">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Thanks! Our team will contact you shortly.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A Library ERP specialist will reach out to schedule your walkthrough and discuss rollout for your branches.
          </p>
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href={ROUTES.LOGIN}>Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Guided onboarding
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Request a demo</h1>
        <p className="text-sm text-muted-foreground">
          Tell us about your library network and the workflows you want to modernize. We provision tenants and owner
          accounts after a short qualification call.
        </p>
      </div>

      <input type="text" tabIndex={-1} autoComplete="off" className="hidden" {...register('website')} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" hasError={!!errors.fullName} {...register('fullName')} />
          <FormMessage>{errors.fullName?.message}</FormMessage>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" autoComplete="email" hasError={!!errors.email} {...register('email')} />
          <FormMessage>{errors.email?.message}</FormMessage>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" type="tel" autoComplete="tel" hasError={!!errors.phone} {...register('phone')} />
          <FormMessage>{errors.phone?.message}</FormMessage>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="libraryName">Library name</Label>
          <Input id="libraryName" hasError={!!errors.libraryName} {...register('libraryName')} />
          <FormMessage>{errors.libraryName?.message}</FormMessage>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">City</Label>
          <Input id="city" hasError={!!errors.city} {...register('city')} />
          <FormMessage>{errors.city?.message}</FormMessage>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="branchCount">Number of branches</Label>
          <Input id="branchCount" type="number" min={1} hasError={!!errors.branchCount} {...register('branchCount', { valueAsNumber: true })} />
          <FormMessage>{errors.branchCount?.message}</FormMessage>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="studentCount">Approx. students</Label>
          <Input id="studentCount" type="number" min={1} hasError={!!errors.studentCount} {...register('studentCount', { valueAsNumber: true })} />
          <FormMessage>{errors.studentCount?.message}</FormMessage>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="currentSystem">Current system</Label>
          <Input id="currentSystem" placeholder="Excel, paper registers, another ERP…" {...register('currentSystem')} />
        </div>
      </div>

      <div className="space-y-3">
        <Label>Interested features</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          {DEMO_REQUEST_FEATURES.map((feature) => {
            const active = selectedFeatures.includes(feature.id);
            return (
              <button
                key={feature.id}
                type="button"
                onClick={() => toggleFeature(feature.id)}
                className={cn(
                  'rounded-xl border p-4 text-left transition-colors',
                  active ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40',
                )}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" aria-hidden />
                  <span className="font-medium">{feature.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Additional notes</Label>
        <textarea
          id="notes"
          rows={4}
          placeholder="Seat counts, billing workflows, rollout timeline…"
          className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          {...register('notes')}
        />
      </div>

      <Button type="submit" className="w-full" loading={isSubmitting}>
        Submit demo request
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already onboarded?{' '}
        <Link href={ROUTES.LOGIN} className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
