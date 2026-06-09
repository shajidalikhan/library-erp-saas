'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { bookingsApi } from '@/modules/bookings/bookings.service';

import { PublicAvailabilitySummary } from './public-availability-summary';
import { PublicBookingForm } from './public-booking-form';
import { PublicBookingSuccess, type PublicBookingHoldResult } from './public-booking-success';
import { PublicBookingSteps, resolveActiveBookingStep } from './public-booking-steps';
import { PublicGallery } from './public-gallery';
import { PublicLocation } from './public-location';
import { PublicPageError, PublicPageLoading, PublicPageShell } from './public-page-shell';
import { PublicPlansSection } from './public-plans-section';
import { PublicSeatMatrix } from './public-seat-matrix';
import { PublicShiftsSection } from './public-shifts-section';
import { plansForShift, showFullSeatBreakdown } from './public-visibility';
import { resolveLibraryLogoUrl } from './utils';

export function PublicBookingFlow() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const slug = params.slug;

  const [branchId, setBranchId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [feePlanId, setFeePlanId] = useState('');
  const [seatId, setSeatId] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submission, setSubmission] = useState<{
    hold: PublicBookingHoldResult;
    message?: string;
  } | null>(null);

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['public-library', slug],
    queryFn: () => bookingsApi.getPublicLibrary(slug),
    enabled: Boolean(slug),
  });

  useEffect(() => {
    const qBranch = searchParams.get('branch');
    const qShift = searchParams.get('shift');
    if (qBranch) setBranchId(qBranch);
    if (qShift) setShiftId(qShift);
  }, [searchParams]);

  useEffect(() => {
    if (profile?.branches.length === 1 && !branchId) {
      setBranchId(profile.branches[0]._id);
    }
  }, [profile, branchId]);

  const { data: availability } = useQuery({
    queryKey: ['public-availability', slug, branchId, shiftId],
    queryFn: () => bookingsApi.getPublicAvailability(slug, { branchId, shiftId }),
    enabled: Boolean(slug && branchId && shiftId),
  });

  const shiftPlans = useMemo(
    () => (profile && shiftId && branchId ? plansForShift(profile, shiftId, branchId) : []),
    [profile, shiftId, branchId],
  );

  useEffect(() => {
    if (shiftPlans.length === 1 && !feePlanId) setFeePlanId(shiftPlans[0]._id);
  }, [shiftPlans, feePlanId]);

  const createMutation = useMutation({
    mutationFn: () =>
      bookingsApi.createPublicBooking(slug, {
        branchId,
        shiftId,
        seatId,
        feePlanId,
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        guardianName: guardianName.trim() || undefined,
        guardianPhone: guardianPhone.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: (res) => {
      const hold = (res.hold ?? res) as PublicBookingHoldResult;
      setSubmission({
        hold,
        message: typeof res.message === 'string' ? res.message : undefined,
      });
      toast.success('Seat reserved for 3 hours');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onError: () => toast.error('Could not reserve seat. Try another seat or refresh.'),
  });

  if (isLoading) return <PublicPageLoading />;
  if (isError || !profile) return <PublicPageError />;
  if (!profile.booking.enabled) {
    return (
      <PublicPageError message="Online booking is not available for this library right now." />
    );
  }

  const logoUrl = resolveLibraryLogoUrl(profile.library.logo);
  const showFull = showFullSeatBreakdown(profile);
  const activeStep = resolveActiveBookingStep({
    branchId,
    shiftId,
    feePlanId,
    seatId,
    hasSubmitted: Boolean(submission),
  });
  const selectedPlan = shiftPlans.find((p) => p._id === feePlanId);

  const stickyCta =
    seatId && !submission ? (
      <Button
        type="button"
        className="w-full"
        size="lg"
        onClick={() => document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth' })}
      >
        Continue to details
      </Button>
    ) : null;

  return (
    <PublicPageShell stickyCta={stickyCta ?? undefined}>
      <header className="sticky top-0 z-30 -mx-4 border-b bg-white/90 px-4 py-3 backdrop-blur-md dark:bg-slate-950/90 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href={`/l/${slug}`} aria-label="Back to library">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{profile.library.name}</p>
            <p className="text-xs text-muted-foreground">Reserve your seat · 3 hour hold</p>
          </div>
        </div>
      </header>

      <div className="mt-6 space-y-10 pb-8">
        {submission ? (
          <PublicBookingSuccess
            slug={slug}
            library={profile.library}
            hold={submission.hold}
            message={submission.message}
          />
        ) : (
          <>
            <PublicBookingSteps activeStep={activeStep} />

            {profile.branches.length > 1 ? (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Select branch</h2>
                <div className="space-y-2">
                  <Label htmlFor="flow-branch">Branch</Label>
                  <select
                    id="flow-branch"
                    className="flex h-11 w-full max-w-md rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
                    value={branchId}
                    onChange={(e) => {
                      setBranchId(e.target.value);
                      setShiftId('');
                      setFeePlanId('');
                      setSeatId('');
                    }}
                  >
                    <option value="">Select branch</option>
                    {profile.branches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.branchName}
                      </option>
                    ))}
                  </select>
                </div>
              </section>
            ) : null}

            <PublicAvailabilitySummary
              summary={profile.seatAvailabilitySummary}
              showFullBreakdown={showFull}
            />

            <PublicShiftsSection
              slug={slug}
              data={profile}
              branchId={branchId}
              selectedShiftId={shiftId}
              compact
              onChooseShift={(sId, bId) => {
                setShiftId(sId);
                setBranchId(bId);
                setFeePlanId('');
                setSeatId('');
                document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />

            {shiftId && branchId ? (
              <div id="plans">
                <PublicPlansSection
                  profile={profile}
                  shiftId={shiftId}
                  branchId={branchId}
                  selectedPlanId={feePlanId}
                  onSelectPlan={(id) => {
                    setFeePlanId(id);
                    setSeatId('');
                    document.getElementById('seat-grid')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                />
              </div>
            ) : null}

            <div id="seat-grid">
              <PublicSeatMatrix
                profile={profile}
                availability={availability}
                branchId={branchId}
                shiftId={shiftId}
                feePlanId={feePlanId}
                seatId={seatId}
                hideFilters
                onSeatSelect={setSeatId}
                onContinue={() =>
                  document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth' })
                }
              />
            </div>

            <PublicBookingForm
              selectedPlan={selectedPlan}
              seatId={seatId}
              fullName={fullName}
              phone={phone}
              email={email}
              guardianName={guardianName}
              guardianPhone={guardianPhone}
              address={address}
              notes={notes}
              onFullNameChange={setFullName}
              onPhoneChange={setPhone}
              onEmailChange={setEmail}
              onGuardianNameChange={setGuardianName}
              onGuardianPhoneChange={setGuardianPhone}
              onAddressChange={setAddress}
              onNotesChange={setNotes}
              onSubmit={() => createMutation.mutate()}
              isSubmitting={createMutation.isPending}
              disabled={!branchId || !shiftId || !seatId || !feePlanId}
            />
          </>
        )}
        <PublicGallery photos={profile.library.coverPhotos} libraryName={profile.library.name} />
        <PublicLocation library={profile.library} />
      </div>
    </PublicPageShell>
  );
}
