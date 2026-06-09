'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PublicLibraryProfile } from '@/modules/bookings/types';

import { formatCurrency } from './utils';

type PlanSummary = PublicLibraryProfile['feePlans'][number];

type PublicBookingFormProps = {
  selectedPlan?: PlanSummary;
  seatId: string;
  fullName: string;
  phone: string;
  email: string;
  guardianName: string;
  guardianPhone: string;
  address: string;
  notes: string;
  onFullNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onGuardianNameChange: (v: string) => void;
  onGuardianPhoneChange: (v: string) => void;
  onAddressChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  disabled: boolean;
};

export function PublicBookingForm({
  selectedPlan,
  seatId,
  fullName,
  phone,
  email,
  guardianName,
  guardianPhone,
  address,
  notes,
  onFullNameChange,
  onPhoneChange,
  onEmailChange,
  onGuardianNameChange,
  onGuardianPhoneChange,
  onAddressChange,
  onNotesChange,
  onSubmit,
  isSubmitting,
  disabled,
}: PublicBookingFormProps) {
  if (!seatId) {
    return (
      <section className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Select a seat above to fill in your details and reserve.
      </section>
    );
  }

  return (
    <section id="booking-form" className="scroll-mt-24 space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Your details</h2>

      {selectedPlan ? (
        <p className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          Selected plan:{' '}
          <span className="font-medium text-foreground">{selectedPlan.name}</span> ·{' '}
          {formatCurrency(selectedPlan.amount)} / {selectedPlan.durationDays} days
        </p>
      ) : null}

      <Card className="border-slate-200/80 dark:border-slate-800">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="fullName">Full name *</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => onFullNameChange(e.target.value)}
              placeholder="Your full name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone *</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              placeholder="10-digit mobile"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email (optional)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="you@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="guardianName">Guardian name (optional)</Label>
            <Input
              id="guardianName"
              value={guardianName}
              onChange={(e) => onGuardianNameChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="guardianPhone">Guardian phone (optional)</Label>
            <Input
              id="guardianPhone"
              value={guardianPhone}
              onChange={(e) => onGuardianPhoneChange(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Address (optional)</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => onAddressChange(e.target.value)}
              placeholder="Area, city"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <textarea
              id="notes"
              className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Any message for the library"
            />
          </div>
        </CardContent>
      </Card>

      <Button
        type="button"
        size="lg"
        className="w-full sm:w-auto"
        disabled={disabled || isSubmitting || !fullName.trim() || !phone.trim()}
        onClick={onSubmit}
      >
        {isSubmitting ? 'Reserving…' : 'Reserve seat for 3 hours'}
      </Button>
      <p className="text-xs text-muted-foreground">
        No online payment. Your seat is held for 3 hours while you visit the library to complete
        admission.
      </p>
    </section>
  );
}
