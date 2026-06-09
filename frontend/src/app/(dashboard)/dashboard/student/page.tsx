'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { IdCard } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { StudentSeatDetails } from '@/components/students/student-seat-details';
import { mediaUrlFromField } from '@/lib/media-url';
import { StudentIdCardPreview } from '@/modules/students/components/student-id-card-preview';
import { studentApi } from '@/modules/students/student.service';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export default function StudentDashboardPage() {
  const [idCardOpen, setIdCardOpen] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['student', 'me', 'profile'],
    queryFn: () => studentApi.me(),
  });
  const seatQuery = useQuery({
    queryKey: ['student', 'me', 'seat'],
    queryFn: () => studentApi.mySeat(),
  });
  const attendanceQuery = useQuery({
    queryKey: ['student', 'me', 'attendance', 'summary'],
    queryFn: () => studentApi.myAttendance({ page: 1, limit: 5 }),
  });
  const paymentsQuery = useQuery({
    queryKey: ['student', 'me', 'payments'],
    queryFn: () => studentApi.myPayments(),
  });

  if (profileQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    );
  }
  if (profileQuery.isError || !profileQuery.data) {
    return <p className="text-sm text-muted-foreground">Unable to load your student profile.</p>;
  }

  const student = profileQuery.data;
  const photoUrl = mediaUrlFromField(student.profilePhoto);
  const membershipExpired = student.membershipEndDate
    ? new Date(student.membershipEndDate) < new Date()
    : false;
  const doc = student.documentProof;
  const docUrl = doc && typeof doc === 'object' && 'url' in doc ? String(doc.url) : null;
  const docName =
    doc && typeof doc === 'object' && 'originalName' in doc
      ? String((doc as { originalName?: string }).originalName)
      : 'Uploaded document';
  const docUploaded =
    doc && typeof doc === 'object' && 'uploadedAt' in doc
      ? String((doc as { uploadedAt?: string }).uploadedAt)
      : null;
  const isPdf = doc && typeof doc === 'object' && 'fileType' in doc && String(doc.fileType).includes('pdf');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">My dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Avatar className="h-16 w-16">
              {photoUrl ? <AvatarImage src={photoUrl} alt={student.fullName} /> : null}
              <AvatarFallback>{initials(student.fullName)}</AvatarFallback>
            </Avatar>
            <div className="space-y-1 text-sm">
              <p className="font-medium">{student.fullName}</p>
              <p className="text-muted-foreground">{student.email ?? 'No email'}</p>
              <p className="text-muted-foreground">{student.phone ?? 'No phone'}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>ID card</CardTitle>
            <IdCard className="h-5 w-5 text-muted-foreground" aria-hidden />
          </CardHeader>
          <CardContent className="space-y-4">
            <StudentIdCardPreview
              useMeEndpoint
              fileName={`id-card-${student.studentId}.pdf`}
              showDownloadButton={false}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setIdCardOpen(true)}>
                View full ID card
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Membership</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Start: {student.membershipStartDate?.slice(0, 10) ?? '-'}</p>
            <p>End: {student.membershipEndDate?.slice(0, 10) ?? 'Open-ended'}</p>
            <p className={membershipExpired ? 'text-destructive' : 'text-emerald-600'}>
              {membershipExpired ? 'Expired' : 'Active'}
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Uploaded documents</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {!docUrl ? (
              <p className="text-muted-foreground">No documents uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                <p className="font-medium">{docName}</p>
                {docUploaded ? (
                  <p className="text-xs text-muted-foreground">
                    Uploaded {new Date(docUploaded).toLocaleString()}
                  </p>
                ) : null}
                {isPdf ? (
                  <iframe
                    title="Document preview"
                    src={docUrl}
                    className="h-64 w-full max-w-lg rounded-md border"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={docUrl} alt={docName} className="max-h-64 rounded-md border object-contain" />
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assigned seat</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {seatQuery.isLoading ? (
              <p className="text-muted-foreground">Loading seat…</p>
            ) : seatQuery.isError ? (
              <p className="text-destructive">Unable to load seat details.</p>
            ) : seatQuery.data ? (
              <StudentSeatDetails seat={seatQuery.data} />
            ) : (
              <p className="text-muted-foreground">No seat assigned yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance summary</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {attendanceQuery.isLoading
              ? 'Loading attendance...'
              : `${attendanceQuery.data?.pagination.total ?? 0} records`}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment summary</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {paymentsQuery.isLoading
              ? 'Loading payments...'
              : paymentsQuery.data
                ? `Outstanding ₹${paymentsQuery.data.outstandingAmount.toFixed(2)} · Paid ₹${paymentsQuery.data.totalPaid.toFixed(2)}`
                : '—'}
          </CardContent>
        </Card>
      </div>

      <Dialog open={idCardOpen} onOpenChange={setIdCardOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>My ID card</DialogTitle>
          </DialogHeader>
          <StudentIdCardPreview
            useMeEndpoint
            fileName={`id-card-${student.studentId}.pdf`}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
