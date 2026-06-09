'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS } from '@/constants/permissions';
import { ROUTES } from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { useLibraryOwnerTenantSync } from '@/hooks/use-sync-library-owner-tenant';
import { useTenantScope } from '@/hooks/use-tenant-scope';
import { ApiError } from '@/lib/api-error';
import { libraryApi } from '@/modules/library/library.service';
import { bookingsApi } from '@/modules/bookings/bookings.service';
import { AdmissionWizard } from '@/modules/students/components/admission/admission-wizard';
import { StudentAdmissionSuccess } from '@/modules/students/components/student-admission-success';
import { studentApi } from '@/modules/students/student.service';
import type { AdmissionResult } from '@/modules/students/types-admission';

export default function CreateStudentPage() {
  const { can, canAny } = usePermissions();
  const { needsSync, isFetching: isTenantSyncing } = useLibraryOwnerTenantSync();
  const { effectiveLibraryId, requiresLibrarySelection, isTenantUser } = useTenantScope();
  const searchParams = useSearchParams();
  const prefillBookingId = searchParams.get('prefillBookingId') ?? '';
  const queryClient = useQueryClient();
  const [admissionResult, setAdmissionResult] = useState<AdmissionResult | null>(null);
  const libraryId = effectiveLibraryId || undefined;

  const { data: branchesData, isLoading } = useQuery({
    queryKey: ['student-new-branches', libraryId],
    queryFn: () => libraryApi.listBranches(libraryId!, { limit: 100 }),
    enabled: Boolean(libraryId) && can(PERMISSIONS.BRANCH_READ),
  });
  const { data: bookingPrefill } = useQuery({
    queryKey: ['booking-admission-prefill', prefillBookingId],
    queryFn: () => bookingsApi.getAdmissionPrefill(prefillBookingId),
    enabled: Boolean(prefillBookingId),
  });

  if (!can(PERMISSIONS.STUDENT_CREATE)) {
    return <EmptyState title="No access" description="You cannot create students." />;
  }

  if (needsSync && isTenantSyncing) {
    return (
      <div className="space-y-6">
        <PageHeader title="Student admission" description="Loading your library workspace…" />
        <div className="space-y-4 rounded-lg border border-border/60 p-6">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (requiresLibrarySelection) {
    return (
      <EmptyState
        title="Select library workspace"
        description="Pick a tenant library first. Use Libraries, add ?libraryId= to the URL, or choose a library on the Seats page — your workspace choice is remembered in this browser."
        action={
          <Button asChild variant="outline">
            <Link href={ROUTES.LIBRARIES}>Go to libraries</Link>
          </Button>
        }
      />
    );
  }

  if (!libraryId) {
    return (
      <EmptyState
        title="Library not linked"
        description={
          isTenantUser
            ? 'Your account is not linked to a library yet. Open Libraries to finish setup or contact support.'
            : 'We could not determine a library for this action.'
        }
        action={
          <Button asChild variant="outline">
            <Link href={ROUTES.LIBRARIES}>Go to libraries</Link>
          </Button>
        }
      />
    );
  }

  const branches =
    branchesData?.items.map((b) => ({ _id: b._id, branchName: b.branchName, branchCode: b.branchCode })) ?? [];

  if (!isLoading && branches.length === 0) {
    return (
      <EmptyState
        title="No branches"
        description="Create a branch before admitting students."
        action={
          <Button asChild variant="outline">
            <Link href={`${ROUTES.LIBRARIES}/${libraryId}/branches/new`}>New branch</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student admission"
        description="Step-by-step admission with optional membership, seat, and payment."
        actions={
          <Button variant="outline" asChild>
            <Link href={ROUTES.STUDENTS}>Back to list</Link>
          </Button>
        }
      />
      {admissionResult ? (
        <StudentAdmissionSuccess result={admissionResult} />
      ) : isLoading ? null : (
        <AdmissionWizard
          libraryId={libraryId}
          branches={branches}
          canMembership={can(PERMISSIONS.MEMBERSHIP_CREATE)}
          canAssignSeat={canAny([PERMISSIONS.SEAT_ASSIGN, PERMISSIONS.STUDENT_ASSIGN_SEAT])}
          canPayment={can(PERMISSIONS.PAYMENT_CREATE)}
          canOverrideDates={can(PERMISSIONS.MEMBERSHIP_UPDATE)}
          canOverridePrice={can(PERMISSIONS.PAYMENT_UPDATE)}
          initialState={
            bookingPrefill
              ? {
                  branchId: String((bookingPrefill.prefill as { branchId?: string })?.branchId ?? ''),
                  shiftId: String((bookingPrefill.prefill as { shiftId?: string })?.shiftId ?? ''),
                  seatShiftId: String((bookingPrefill.prefill as { shiftId?: string })?.shiftId ?? ''),
                  seatId: String((bookingPrefill.prefill as { seatId?: string })?.seatId ?? ''),
                  assignSeat: true,
                  fullName: String((bookingPrefill.prefill as { fullName?: string })?.fullName ?? ''),
                  phone: String((bookingPrefill.prefill as { phone?: string })?.phone ?? ''),
                  email: String((bookingPrefill.prefill as { email?: string })?.email ?? ''),
                  guardianName: String((bookingPrefill.prefill as { guardianName?: string })?.guardianName ?? ''),
                  guardianPhone: String((bookingPrefill.prefill as { guardianPhone?: string })?.guardianPhone ?? ''),
                  address: String((bookingPrefill.prefill as { address?: string })?.address ?? ''),
                  city: String((bookingPrefill.prefill as { city?: string })?.city ?? ''),
                  state: String((bookingPrefill.prefill as { state?: string })?.state ?? ''),
                  pincode: String((bookingPrefill.prefill as { pincode?: string })?.pincode ?? ''),
                  notes: String((bookingPrefill.prefill as { notes?: string })?.notes ?? ''),
                }
              : undefined
          }
          onSubmit={async (payload, files) => {
            try {
              const result = await studentApi.admitAdmission(payload, files);
              toast.success('Student admitted');
              await queryClient.invalidateQueries({ queryKey: ['students'] });
              setAdmissionResult(result);
              return result;
            } catch (e) {
              if (e instanceof ApiError) toast.error(e.message);
              else toast.error('Could not complete admission');
              throw e;
            }
          }}
        />
      )}
    </div>
  );
}
