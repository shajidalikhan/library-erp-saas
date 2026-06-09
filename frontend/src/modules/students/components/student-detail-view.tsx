'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Calendar, CreditCard, Download, FileText, IdCard, Pencil, User, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Can } from '@/components/auth/can';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PERMISSIONS } from '@/constants/permissions';
import {
  studentEditRoute,
  studentSummaryRoute,
  paymentStudentHistoryRoute,
  paymentInvoiceRoute,
  paymentReceiptRoute,
} from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/store/auth.store';
import { ApiError } from '@/lib/api-error';
import { formatEntityLabel } from '@/lib/entity-label';
import { mediaUrlFromField } from '@/lib/media-url';
import { libraryApi } from '@/modules/library/library.service';
import { SeatSelect } from '@/components/selectors/seat-select';
import { resolveEmergencyContactPhone } from '@/modules/students/lib/student-contact';
import { shiftApi } from '@/modules/shifts/shift.service';
import { studentApi } from '@/modules/students/student.service';
import { studentQueryKeys } from '@/modules/students/student-query-keys';
import { paymentCollectStudentRoute } from '@/constants/routes';
import { attendanceApi } from '@/modules/attendance/attendance.service';
import { AttendanceStatusBadge } from '@/modules/attendance/components/attendance-status-badge';
import { paymentApi } from '@/modules/payments/payment.service';
import { membershipApi } from '@/modules/membership/membership.service';
import { shouldShowLongDurationSection } from '@/modules/membership/membership-display.util';
import { formatCurrency } from '@/lib/utils';
import { StudentIdCardPreview } from '@/modules/students/components/student-id-card-preview';
import { paymentQueryKeys } from '@/modules/payments/payment-query-keys';
import { InvoiceStatusBadge } from '@/modules/payments/components/invoice-status-badge';
import { PaymentMethodBadge } from '@/modules/payments/components/payment-method-badge';
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function StudentDetailView({ studentId }: { studentId: string }) {
  const searchParams = useSearchParams();
  const { can, canAny } = usePermissions();
  const queryClient = useQueryClient();
  const libraryId = useAuthStore((s) => s.user?.libraryId);

  const { data: student, isLoading, error } = useQuery({
    queryKey: studentQueryKeys.detail(studentId),
    queryFn: () => studentApi.get(studentId),
    enabled: Boolean(studentId),
  });

  const { data: memberships = [] } = useQuery({
    queryKey: ['student-memberships', studentId],
    queryFn: () => membershipApi.listForStudent(studentId),
    enabled: Boolean(studentId) && can(PERMISSIONS.MEMBERSHIP_READ),
  });

  const activeMembership = memberships.find((m) => m.status === 'ACTIVE') ?? memberships[0];
  const showLongDurationSection = shouldShowLongDurationSection(activeMembership);

  const { data: branchesData } = useQuery({
    queryKey: ['student-detail-branches', libraryId ?? student?.libraryId],
    queryFn: () => libraryApi.listBranches((libraryId ?? student?.libraryId)!, { limit: 100 }),
    enabled: Boolean(libraryId ?? student?.libraryId) && can(PERMISSIONS.BRANCH_READ),
  });

  const { data: branchShifts = [] } = useQuery({
    queryKey: ['student-detail-shifts', student?.branchId],
    queryFn: () => shiftApi.list({ branchId: student!.branchId, active: 'true' }),
    enabled: Boolean(student?.branchId),
  });

  const [transferOpen, setTransferOpen] = useState(false);
  const [targetBranchId, setTargetBranchId] = useState('');
  const [seatInput, setSeatInput] = useState('');
  const [shiftInput, setShiftInput] = useState('');
  const [activeTab, setActiveTab] = useState('profile');
  const [idCardOpen, setIdCardOpen] = useState(false);
  const [idCardDownloading, setIdCardDownloading] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (!tab) return;
    if (['profile', 'membership', 'attendance', 'payments', 'notes'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!student) return;
    setSeatInput(student.assignedSeatId ?? '');
  }, [student?._id, student?.assignedSeatId]);

  const transferMutation = useMutation({
    mutationFn: (branchId: string) => studentApi.transfer(studentId, branchId),
    onSuccess: async () => {
      toast.success('Student transferred');
      setTransferOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      await queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Transfer failed'),
  });

  const seatMutation = useMutation({
    mutationFn: (payload: { assignedSeatId: string | null; shiftId?: string }) =>
      studentApi.assignSeat(studentId, payload.assignedSeatId, payload.shiftId),
    onSuccess: async () => {
      toast.success('Seat assignment updated');
      await queryClient.invalidateQueries({ queryKey: studentQueryKeys.detail(studentId) });
      await queryClient.invalidateQueries({ queryKey: ['students'] });
      await queryClient.invalidateQueries({ queryKey: ['seats'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Update failed'),
  });

  const canAssignSeat = canAny([PERMISSIONS.STUDENT_ASSIGN_SEAT, PERMISSIONS.SEAT_ASSIGN]);

  const attendanceHistoryQuery = useQuery({
    queryKey: ['student-attendance-history', studentId],
    queryFn: () =>
      attendanceApi.studentHistory(studentId, {
        page: 1,
        limit: 20,
        sortBy: 'date',
        sortOrder: 'desc',
      }),
    enabled: Boolean(studentId && activeTab === 'attendance'),
  });

  const paymentHistoryQuery = useQuery({
    queryKey: paymentQueryKeys.history(studentId),
    queryFn: () => paymentApi.studentHistory(studentId),
    enabled: Boolean(studentId && activeTab === 'payments' && can(PERMISSIONS.PAYMENT_READ)),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !student) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {error instanceof ApiError ? error.message : 'Student not found'}
        </CardContent>
      </Card>
    );
  }

  const showPii = can(PERMISSIONS.STUDENT_READ);
  const photoUrl = mediaUrlFromField(student.profilePhoto);
  const docProof = student.documentProof;

  const downloadIdCard = async () => {
    setIdCardDownloading(true);
    try {
      const blob = await studentApi.downloadIdCard(studentId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `id-card-${student.studentId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not download ID card');
    } finally {
      setIdCardDownloading(false);
    }
  };
  const branchName = formatEntityLabel(
    {
      branchName: branchesData?.items.find((b) => b._id === student.branchId)?.branchName,
      branchCode: branchesData?.items.find((b) => b._id === student.branchId)?.branchCode,
    },
    'branch',
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-4">
          <Avatar className="h-16 w-16 border border-border/60 shadow-soft">
            <AvatarImage src={photoUrl} alt={student.fullName} />
            <AvatarFallback className="text-lg">{initials(student.fullName)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{student.fullName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-mono text-xs">{student.studentId}</span>
              <span className="mx-2">·</span>
              {branchName}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">{student.status}</Badge>
              {student.membershipEndDate ? (
                <Badge variant="outline">Until {student.membershipEndDate.slice(0, 10)}</Badge>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={studentSummaryRoute(studentId)}>Profile summary</Link>
          </Button>
          <Can permission={PERMISSIONS.STUDENT_UPDATE}>
            <Button size="sm" asChild>
              <Link href={studentEditRoute(studentId)}>
                <Pencil className="mr-2 h-4 w-4" aria-hidden />
                Edit
              </Link>
            </Button>
          </Can>
          {canAny([PERMISSIONS.ID_CARD_GENERATE, PERMISSIONS.STUDENT_READ]) ? (
            <>
            <Button type="button" size="sm" variant="outline" onClick={() => setIdCardOpen(true)}>
              <IdCard className="mr-2 h-4 w-4" aria-hidden />
              View ID card
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={idCardDownloading}
              onClick={() => void downloadIdCard()}
            >
              <Download className="mr-2 h-4 w-4" aria-hidden />
              {idCardDownloading ? 'Downloading…' : 'Download ID card'}
            </Button>
            </>
          ) : null}
        </div>
      </div>

      <Dialog open={idCardOpen} onOpenChange={setIdCardOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Student ID card</DialogTitle>
            <DialogDescription>
              Printable card for {student.fullName} ({student.studentId})
            </DialogDescription>
          </DialogHeader>
          <StudentIdCardPreview
            studentId={studentId}
            fileName={`id-card-${student.studentId}.pdf`}
            onDownload={() => void downloadIdCard()}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIdCardOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="profile" className="gap-1">
            <User className="h-3.5 w-3.5" aria-hidden />
            Profile
          </TabsTrigger>
          <TabsTrigger value="membership" className="gap-1">
            <Calendar className="h-3.5 w-3.5" aria-hidden />
            Membership
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-1">
            <Users className="h-3.5 w-3.5" aria-hidden />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1">
            <CreditCard className="h-3.5 w-3.5" aria-hidden />
            Payments
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-1">
            <FileText className="h-3.5 w-3.5" aria-hidden />
            Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/60 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base">Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {showPii ? (
                  <>
                    <p>
                      <span className="text-muted-foreground">Email:</span> {student.email ?? '—'}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Phone:</span> {student.phone ?? '—'}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">Limited profile — contact reception for full details.</p>
                )}
                <p>
                  <span className="text-muted-foreground">Gender:</span> {student.gender ?? '—'}
                </p>
                <p>
                  <span className="text-muted-foreground">DOB:</span>{' '}
                  {student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : '—'}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/60 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base">Address</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {showPii ? (
                  <>
                    <p>{student.address || '—'}</p>
                    <p>{[student.city, student.state, student.pincode].filter(Boolean).join(', ') || '—'}</p>
                  </>
                ) : (
                  <p>Address hidden for your role.</p>
                )}
              </CardContent>
            </Card>
            {showPii ? (
              <Card className="border-border/60 shadow-soft lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Emergency & guardian</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Emergency contact phone:</span>{' '}
                    {resolveEmergencyContactPhone(student) || '—'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Guardian:</span>{' '}
                    {student.guardianName ?? '—'} / {student.guardianPhone ?? '—'}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="text-muted-foreground">Aadhaar / ID:</span> {student.aadhaarNumber ?? '—'}
                  </p>
                  {docProof ? (
                    <p className="sm:col-span-2">
                      <span className="text-muted-foreground">Document proof:</span>{' '}
                      <a
                        href={docProof.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        View document
                      </a>
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="membership" className="space-y-4">
          <Card className="border-border/60 shadow-soft">
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base">Membership window</CardTitle>
                <CardDescription>Admission and renewal dates.</CardDescription>
              </div>
              <Can permission={PERMISSIONS.PAYMENT_CREATE}>
                <Button size="sm" variant="secondary" asChild>
                  <Link href={paymentCollectStudentRoute(studentId)}>
                    <CreditCard className="mr-2 h-4 w-4" aria-hidden />
                    Renew membership
                  </Link>
                </Button>
              </Can>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Admission</p>
                <p className="font-medium">{student.admissionDate?.slice(0, 10) ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Start</p>
                <p className="font-medium">{student.membershipStartDate?.slice(0, 10) ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">End</p>
                <p className="font-medium">{student.membershipEndDate?.slice(0, 10) ?? 'Open-ended'}</p>
              </div>
            </CardContent>
          </Card>

          {showLongDurationSection && activeMembership ? (
            <Card className="border-border/60 shadow-soft">
              <CardHeader>
                <CardTitle className="text-base">Long-duration plan</CardTitle>
                <CardDescription>Partial payment and downgrade status.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {activeMembership.downgradeStatus === 'PENDING' ? (
                  <p className="text-amber-700 dark:text-amber-400">
                    Long-duration plan active.{' '}
                    {formatCurrency(activeMembership.pendingUpgradeAmount ?? activeMembership.linkedInvoice?.dueAmount ?? 0, 'INR')}{' '}
                    due by{' '}
                    {(activeMembership.downgradeDueDate ?? activeMembership.linkedInvoice?.dueDate)?.slice(0, 10)}.
                    If unpaid, validity will reduce to{' '}
                    {activeMembership.effectiveDurationDays && activeMembership.selectedPlanDurationDays
                      ? Math.min(activeMembership.effectiveDurationDays, 30)
                      : 30}{' '}
                    days.
                  </p>
                ) : null}
                {activeMembership.downgradeStatus === 'COMPLETED' ? (
                  <p className="text-destructive">
                    Membership reduced to {activeMembership.effectiveDurationDays ?? 30} days because
                    remaining payment was not completed by due date.
                  </p>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Selected duration</p>
                    <p className="font-medium">
                      {activeMembership.selectedPlanDurationDays
                        ? `${activeMembership.selectedPlanDurationDays} days`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Effective validity</p>
                    <p className="font-medium">
                      {activeMembership.effectiveDurationDays
                        ? `${activeMembership.effectiveDurationDays} days`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Original end</p>
                    <p className="font-medium">
                      {activeMembership.originalEndDate?.slice(0, 10) ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Effective end</p>
                    <p className="font-medium">
                      {activeMembership.effectiveEndDate?.slice(0, 10) ??
                        student.membershipEndDate?.slice(0, 10) ??
                        '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Due amount</p>
                    <p className="font-medium">
                      {formatCurrency(
                        activeMembership.pendingUpgradeAmount ??
                          activeMembership.linkedInvoice?.dueAmount ??
                          0,
                        'INR',
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Downgrade status</p>
                    <p className="font-medium">{activeMembership.downgradeStatus ?? 'NONE'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-border/60 shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base">Branch transfer</CardTitle>
                <CardDescription>Move the student to another branch in the same library.</CardDescription>
              </div>
              <Can permission={PERMISSIONS.STUDENT_TRANSFER}>
                <Button size="sm" variant="secondary" onClick={() => setTransferOpen(true)}>
                  <Building2 className="mr-2 h-4 w-4" aria-hidden />
                  Transfer
                </Button>
              </Can>
            </CardHeader>
          </Card>

          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">Seat assignment</CardTitle>
              <CardDescription>Shift-wise seat occupancy for this member.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {student.assignedSeatId && student.seatNumber ? (
                <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Seat</span>
                    <br />
                    <span className="font-medium">{student.seatNumber}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Floor / zone</span>
                    <br />
                    {[student.seatFloor, student.seatZone].filter(Boolean).join(' · ') || '—'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Type / shift</span>
                    <br />
                    {[student.seatType, student.shiftType].filter(Boolean).join(' · ') || '—'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Status</span>
                    <br />
                    {student.seatStatus ?? '—'}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="text-muted-foreground">Branch</span>
                    <br />
                    {branchName}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No seat assigned yet.</p>
              )}
              {canAssignSeat ? (
                <div className="flex flex-col gap-3 border-t pt-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SeatSelect
                      label="Assign seat"
                      libraryId={libraryId ?? student.libraryId}
                      branchId={student.branchId}
                      value={seatInput}
                      onChange={(id) => setSeatInput(id)}
                      availableOnly={!student.assignedSeatId}
                    />
                    <div className="space-y-2">
                      <Label>Shift</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={shiftInput}
                        onChange={(e) => setShiftInput(e.target.value)}
                      >
                        <option value="">Select shift…</option>
                        {branchShifts.map((sh) => (
                          <option key={sh._id} value={sh._id}>
                            {sh.name} ({sh.startTime}–{sh.endTime})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        const v = seatInput.trim();
                        if (!v) {
                          toast.error('Select a seat to assign');
                          return;
                        }
                        if (!shiftInput) {
                          toast.error('Select a shift for this assignment');
                          return;
                        }
                        void seatMutation.mutate({ assignedSeatId: v, shiftId: shiftInput });
                      }}
                      disabled={seatMutation.isPending || !seatInput.trim()}
                      loading={seatMutation.isPending}
                    >
                      Assign seat
                    </Button>
                    {student.assignedSeatId ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={seatMutation.isPending}
                        onClick={() => void seatMutation.mutate({ assignedSeatId: null })}
                      >
                        Unassign seat
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">Attendance history</CardTitle>
              <CardDescription>Recent sessions for this student.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {attendanceHistoryQuery.isLoading ? (
                <Skeleton className="h-44 w-full rounded-lg" />
              ) : attendanceHistoryQuery.isError ? (
                <p className="text-sm text-muted-foreground">Unable to load attendance history.</p>
              ) : !attendanceHistoryQuery.data || attendanceHistoryQuery.data.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attendance records found.</p>
              ) : (
                attendanceHistoryQuery.data.items.map((row) => (
                  <div key={row._id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <div>
                      <p>{row.date ? new Date(row.date).toLocaleDateString() : '-'}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.checkInAt ? new Date(row.checkInAt).toLocaleString() : '-'} -{' '}
                        {row.checkOutAt ? new Date(row.checkOutAt).toLocaleString() : '-'}
                      </p>
                    </div>
                    <AttendanceStatusBadge status={row.status} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          {!can(PERMISSIONS.PAYMENT_READ) ? (
            <Card className="border-border/60 shadow-soft">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                You need <span className="font-mono text-xs">payment.read</span> to view billing for this student.
              </CardContent>
            </Card>
          ) : paymentHistoryQuery.isLoading ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : paymentHistoryQuery.isError ? (
            <Card className="border-border/60 shadow-soft">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Unable to load payment history.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {paymentHistoryQuery.data?.invoices?.length ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Card className="border-border/60 shadow-soft">
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Total invoiced</p>
                      <p className="text-lg font-semibold">
                        ₹
                        {paymentHistoryQuery.data.invoices
                          .reduce((s, i) => s + i.totalAmount, 0)
                          .toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60 shadow-soft">
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Total paid</p>
                      <p className="text-lg font-semibold">
                        ₹
                        {paymentHistoryQuery.data.invoices
                          .reduce((s, i) => s + i.paidAmount, 0)
                          .toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60 shadow-soft">
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Outstanding due</p>
                      <p className="text-lg font-semibold text-amber-700 dark:text-amber-400">
                        ₹
                        {paymentHistoryQuery.data.invoices
                          .reduce((s, i) => s + i.dueAmount, 0)
                          .toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardDescription>Open invoices and recent receipts for this student.</CardDescription>
                <div className="flex flex-wrap gap-2">
                  <Can permission={PERMISSIONS.PAYMENT_CREATE}>
                    <Button size="sm" asChild>
                      <Link href={paymentCollectStudentRoute(studentId)}>Collect payment</Link>
                    </Button>
                  </Can>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={paymentStudentHistoryRoute(studentId)}>Full payment history</Link>
                  </Button>
                </div>
              </div>
              <Card className="border-border/60 shadow-soft">
                <CardHeader>
                  <CardTitle className="text-base">Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                  {!paymentHistoryQuery.data?.invoices?.length ? (
                    <p className="text-sm text-muted-foreground">No invoices yet.</p>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Number</TableHead>
                            <TableHead>Due</TableHead>
                            <TableHead>Balance</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paymentHistoryQuery.data.invoices.slice(0, 15).map((inv) => (
                            <TableRow key={inv._id}>
                              <TableCell>
                                <Link
                                  href={paymentInvoiceRoute(inv._id)}
                                  className="font-mono text-xs text-primary hover:underline"
                                >
                                  {inv.invoiceNumber}
                                </Link>
                              </TableCell>
                              <TableCell>{inv.dueDate?.slice(0, 10)}</TableCell>
                              <TableCell>₹{inv.dueAmount.toFixed(2)}</TableCell>
                              <TableCell>
                                <InvoiceStatusBadge status={inv.status} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="border-border/60 shadow-soft">
                <CardHeader>
                  <CardTitle className="text-base">Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  {!paymentHistoryQuery.data?.payments?.length ? (
                    <p className="text-sm text-muted-foreground">No payments recorded.</p>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Receipt</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paymentHistoryQuery.data.payments.slice(0, 15).map((p) => (
                            <TableRow key={p._id}>
                              <TableCell>
                                <Link
                                  href={paymentReceiptRoute(p._id)}
                                  className="font-mono text-xs text-primary hover:underline"
                                >
                                  {p.receiptNumber}
                                </Link>
                              </TableCell>
                              <TableCell>{new Date(p.paidAt).toLocaleString()}</TableCell>
                              <TableCell>
                                <PaymentMethodBadge method={p.method} />
                              </TableCell>
                              <TableCell>₹{p.amount.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes">
          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">Internal notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{student.notes || 'No notes yet.'}</p>
              <Can permission={PERMISSIONS.STUDENT_UPDATE}>
                <Button className="mt-4" variant="outline" size="sm" asChild>
                  <Link href={studentEditRoute(studentId)}>Edit in form</Link>
                </Button>
              </Can>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer student</DialogTitle>
            <DialogDescription>Select the destination branch within this library.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="tb">Branch</Label>
            <select
              id="tb"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={targetBranchId}
              onChange={(e) => setTargetBranchId(e.target.value)}
            >
              <option value="">Select…</option>
              {branchesData?.items
                .filter((b) => b._id !== student.branchId)
                .map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.branchName}
                  </option>
                ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!targetBranchId || transferMutation.isPending}
              onClick={() => transferMutation.mutate(targetBranchId)}
            >
              Confirm transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
