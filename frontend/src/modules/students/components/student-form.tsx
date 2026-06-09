'use client';

import { useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { mediaAssetFromField, type MediaAsset } from '@/lib/media-url';
import { DocumentUploadField } from '@/components/upload/document-upload-field';
import { StudentPhotoUploadField } from '@/components/upload/student-photo-upload-field';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormMessage } from '@/components/ui/form-message';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { resolveEmergencyContactPhone } from '../lib/student-contact';
import { studentFormSchema, type StudentFormValues } from '../student.validation';
import type { Student } from '../types';
import {
  resolveStudentSeatShiftId,
  StudentFormSeatSection,
  type SeatAssignmentDraft,
} from './student-form-seat-section';

export interface BranchOption {
  _id: string;
  branchName: string;
  branchCode: string;
}

function isoDateOnly(d?: string | null): string {
  if (!d) return '';
  return d.slice(0, 10);
}

function studentToDefaults(s: Student): StudentFormValues {
  return {
    branchId: s.branchId,
    fullName: s.fullName,
    email: s.email ?? '',
    phone: s.phone ?? '',
    gender: (s.gender as StudentFormValues['gender']) ?? 'UNSPECIFIED',
    dateOfBirth: isoDateOnly(s.dateOfBirth),
    address: s.address ?? '',
    city: s.city ?? '',
    state: s.state ?? '',
    pincode: s.pincode ?? '',
    emergencyContactPhone: resolveEmergencyContactPhone(s),
    guardianName: s.guardianName ?? '',
    guardianPhone: s.guardianPhone ?? '',
    aadhaarNumber: s.aadhaarNumber ?? '',
    admissionDate: isoDateOnly(s.admissionDate),
    membershipStartDate: isoDateOnly(s.membershipStartDate),
    membershipEndDate: isoDateOnly(s.membershipEndDate),
    status: s.status,
    notes: s.notes ?? '',
    createLoginAccount: false,
    temporaryPassword: '',
  };
}

const emptyDefaults: StudentFormValues = {
  branchId: '',
  fullName: '',
  email: '',
  phone: '',
  gender: 'UNSPECIFIED',
  dateOfBirth: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  emergencyContactPhone: '',
  guardianName: '',
  guardianPhone: '',
  aadhaarNumber: '',
  admissionDate: '',
  membershipStartDate: '',
  membershipEndDate: '',
  status: 'ACTIVE',
  notes: '',
  createLoginAccount: false,
  temporaryPassword: '',
};

function toPayload(
  values: StudentFormValues,
  mode: 'create' | 'edit',
  seatDraft?: SeatAssignmentDraft,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    branchId: values.branchId,
    fullName: values.fullName.trim(),
    email: values.email.trim(),
    gender: values.gender,
    status: values.status,
  };

  const opt = (k: keyof StudentFormValues) => {
    const v = values[k];
    if (typeof v === 'string' && v.trim() !== '') {
      if (k === 'dateOfBirth' || k === 'admissionDate' || k === 'membershipStartDate' || k === 'membershipEndDate') {
        payload[k] = new Date(v).toISOString();
      } else {
        payload[k as string] = v.trim();
      }
    }
  };

  opt('phone');
  opt('dateOfBirth');
  opt('address');
  opt('city');
  opt('state');
  opt('pincode');
  opt('emergencyContactPhone');
  opt('guardianName');
  opt('guardianPhone');
  opt('aadhaarNumber');
  opt('admissionDate');
  opt('membershipStartDate');
  if (values.membershipEndDate?.trim()) {
    payload.membershipEndDate = new Date(values.membershipEndDate).toISOString();
  } else if (mode === 'edit') {
    payload.membershipEndDate = null;
  }
  opt('notes');

  if (seatDraft?.touched) {
    payload.assignedSeatId = seatDraft.seatId;
    if (seatDraft.seatId && seatDraft.shiftId) {
      payload.shiftId = seatDraft.shiftId;
    }
  }

  if (mode === 'create') {
    payload.createLoginAccount = values.createLoginAccount;
    if (values.createLoginAccount && values.temporaryPassword?.trim()) {
      payload.temporaryPassword = values.temporaryPassword.trim();
    }
  }

  if (mode === 'edit') {
    delete payload.branchId;
  }

  return payload;
}

export interface StudentFormProps {
  mode: 'create' | 'edit';
  initial?: Student | null;
  branches: BranchOption[];
  canAssignSeat?: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}

export function StudentForm({ mode, initial, branches, canAssignSeat, onSubmit }: StudentFormProps) {
  const defaults = initial ? studentToDefaults(initial) : { ...emptyDefaults, branchId: branches[0]?._id ?? '' };
  const branchName = useMemo(
    () => branches.find((b) => b._id === initial?.branchId)?.branchName,
    [branches, initial?.branchId],
  );

  const [profilePhotoAsset, setProfilePhotoAsset] = useState<MediaAsset | null>(() =>
    initial ? mediaAssetFromField(initial.profilePhoto) : null,
  );
  const [documentProofAsset, setDocumentProofAsset] = useState<MediaAsset | null>(() =>
    initial?.documentProof ? mediaAssetFromField(initial.documentProof) : null,
  );
  const [seatDraft, setSeatDraft] = useState<SeatAssignmentDraft>(() => ({
    seatId: initial?.assignedSeatId ?? null,
    shiftId: initial ? resolveStudentSeatShiftId(initial) : '',
    touched: false,
  }));
  const [seatLabel, setSeatLabel] = useState(initial?.seatNumber ?? '');

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema) as Resolver<StudentFormValues>,
    defaultValues: defaults,
  });

  const submit = handleSubmit(async (values) => {
    const hasAssignedSeat = Boolean(initial?.assignedSeatId ?? seatDraft.seatId);
    const becomingInactive =
      mode === 'edit' &&
      initial?.status === 'ACTIVE' &&
      (values.status === 'INACTIVE' || values.status === 'SUSPENDED') &&
      hasAssignedSeat;

    if (becomingInactive) {
      const confirmed = window.confirm(
        'Marking this student inactive will release their assigned seat. Continue?',
      );
      if (!confirmed) return;
    }

    try {
      const payload = toPayload(
        values,
        mode,
        mode === 'edit' && canAssignSeat ? seatDraft : undefined,
      );
      if (profilePhotoAsset) payload.profilePhoto = profilePhotoAsset;
      if (documentProofAsset) payload.documentProof = documentProofAsset;
      await onSubmit(payload);
    } catch (e) {
      setError('root', { message: e instanceof Error ? e.message : 'Save failed' });
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
          <CardTitle className="text-lg">Admission</CardTitle>
          <CardDescription>Branch context and programme dates.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="branchId">Branch</Label>
            {mode === 'edit' ? (
              <>
                <input type="hidden" {...register('branchId')} />
                <Input
                  id="branchIdDisplay"
                  disabled
                  value={branches.find((b) => b._id === initial?.branchId)?.branchName ?? ''}
                />
              </>
            ) : (
              <select
                id="branchId"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register('branchId')}
              >
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.branchName} ({b.branchCode})
                  </option>
                ))}
              </select>
            )}
            <FormMessage>{errors.branchId?.message}</FormMessage>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admissionDate">Admission date</Label>
            <Input id="admissionDate" type="date" {...register('admissionDate')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="membershipStartDate">Membership start</Label>
            <Input id="membershipStartDate" type="date" {...register('membershipStartDate')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="membershipEndDate">Membership end</Label>
            <Input id="membershipEndDate" type="date" {...register('membershipEndDate')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...register('status')}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Identity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" hasError={!!errors.fullName} {...register('fullName')} />
            <FormMessage>{errors.fullName?.message}</FormMessage>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" hasError={!!errors.email} {...register('email')} />
            <FormMessage>{errors.email?.message}</FormMessage>
          </div>
          {mode === 'create' ? (
            <div className="space-y-2 sm:col-span-2 rounded-md border border-border/60 p-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register('createLoginAccount')} />
                Create login account for student
              </label>
              <p className="text-xs text-muted-foreground">Enables portal access with STUDENT role.</p>
              <div className="space-y-1.5">
                <Label htmlFor="temporaryPassword">Temporary password</Label>
                <Input
                  id="temporaryPassword"
                  type="password"
                  placeholder="Min 8 chars"
                  hasError={!!errors.temporaryPassword}
                  {...register('temporaryPassword')}
                />
                <FormMessage>{errors.temporaryPassword?.message}</FormMessage>
              </div>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...register('phone')} />
            <FormMessage>{errors.phone?.message}</FormMessage>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gender">Gender</Label>
            <select
              id="gender"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...register('gender')}
            >
              <option value="UNSPECIFIED">Unspecified</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dateOfBirth">Date of birth</Label>
            <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="aadhaarNumber">Aadhaar / ID reference</Label>
            <Input id="aadhaarNumber" {...register('aadhaarNumber')} />
          </div>
          <div className="sm:col-span-2">
            <StudentPhotoUploadField value={profilePhotoAsset} onChange={setProfilePhotoAsset} />
          </div>
          <div className="sm:col-span-2">
            <DocumentUploadField
              label="Document proof (Aadhaar)"
              value={documentProofAsset}
              onChange={setDocumentProofAsset}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Address</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">Street</Label>
            <Input id="address" {...register('address')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <Input id="city" {...register('city')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">State</Label>
            <Input id="state" {...register('state')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pincode">Pincode</Label>
            <Input id="pincode" {...register('pincode')} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Emergency & guardian</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="emergencyContactPhone">Emergency contact phone</Label>
            <Input id="emergencyContactPhone" {...register('emergencyContactPhone')} />
            <p className="text-xs text-muted-foreground">Shown on the student ID card.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guardianName">Guardian name</Label>
            <Input id="guardianName" {...register('guardianName')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guardianPhone">Guardian phone</Label>
            <Input id="guardianPhone" {...register('guardianPhone')} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            {...register('notes')}
          />
        </CardContent>
      </Card>

      {mode === 'edit' && canAssignSeat && initial ? (
        <StudentFormSeatSection
          student={initial}
          branchName={branchName}
          draft={seatDraft}
          seatLabel={seatLabel}
          onDraftChange={setSeatDraft}
          onSeatLabelChange={setSeatLabel}
        />
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : mode === 'create' ? (
            'Create student'
          ) : (
            'Save changes'
          )}
        </Button>
      </div>
    </form>
  );
}
