'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { BranchSelect } from '@/components/selectors/branch-select';
import { StudentSelect } from '@/components/selectors/student-select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PERMISSIONS, ROLES } from '@/constants/permissions';
import { usePermissions } from '@/hooks/use-permissions';
import { useTenantScope } from '@/hooks/use-tenant-scope';
import { useAuthStore } from '@/store/auth.store';
import { ApiError } from '@/lib/api-error';
import { attendanceApi } from '@/modules/attendance/attendance.service';
import { attendanceQueryKeys } from '@/modules/attendance/attendance-query-keys';
import type { Student } from '@/modules/students/types';

export default function AttendanceCheckInPage() {
  const { canAny } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const { effectiveLibraryId } = useTenantScope();
  const qc = useQueryClient();

  const canCheckIn = canAny([PERMISSIONS.ATTENDANCE_CHECK_IN, PERMISSIONS.ATTENDANCE_CREATE]);
  const canCheckOut = canAny([PERMISSIONS.ATTENDANCE_CHECK_OUT, PERMISSIONS.ATTENDANCE_CREATE]);

  const libraryId = user?.role === ROLES.SUPER_ADMIN ? effectiveLibraryId : user?.libraryId ?? '';
  const [branchId, setBranchId] = useState(user?.branchId ?? '');

  useEffect(() => {
    if (user?.branchId) setBranchId(user.branchId);
  }, [user?.branchId]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const branchReady = Boolean(branchId);

  const activeParams = useMemo(
    () => ({
      libraryId: libraryId || undefined,
      branchId: branchId || undefined,
      studentId: selectedStudentId || undefined,
      activeOnly: true,
      limit: 1,
      page: 1,
    }),
    [libraryId, branchId, selectedStudentId],
  );

  const activeQuery = useQuery({
    queryKey: attendanceQueryKeys.active(activeParams),
    queryFn: () => attendanceApi.active(activeParams),
    enabled: Boolean(selectedStudentId && branchReady),
    select: (d) => d.items[0] ?? null,
  });

  const checkInMutation = useMutation({
    mutationFn: (studentId: string) =>
      attendanceApi.checkIn({
        studentId,
        libraryId: libraryId || undefined,
        branchId: branchId || undefined,
      }),
    onSuccess: (attendance, studentId) => {
      toast.success('Student checked in');
      const params = {
        libraryId: libraryId || undefined,
        branchId: branchId || undefined,
        studentId,
        activeOnly: true as const,
        limit: 1,
        page: 1,
      };
      qc.setQueryData(attendanceQueryKeys.active(params), {
        items: [attendance],
        pagination: {
          total: 1,
          page: 1,
          limit: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });
      void qc.invalidateQueries({ queryKey: attendanceQueryKeys.all });
    },
    onError: async (e) => {
      if (e instanceof ApiError && e.statusCode === 409) {
        toast.info('Student is already checked in.');
        await activeQuery.refetch();
        void qc.invalidateQueries({ queryKey: attendanceQueryKeys.all });
        return;
      }
      toast.error(e instanceof ApiError ? e.message : 'Check-in failed');
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: (studentId: string) =>
      attendanceApi.checkOut({
        studentId,
        libraryId: libraryId || undefined,
        branchId: branchId || undefined,
      }),
    onSuccess: (_attendance, studentId) => {
      toast.success('Student checked out');
      const params = {
        libraryId: libraryId || undefined,
        branchId: branchId || undefined,
        studentId,
        activeOnly: true as const,
        limit: 1,
        page: 1,
      };
      qc.setQueryData(attendanceQueryKeys.active(params), {
        items: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 1,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      });
      void qc.invalidateQueries({ queryKey: attendanceQueryKeys.all });
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : 'Check-out failed');
    },
  });

  if (!canCheckIn && !canCheckOut) {
    return <p className="text-sm text-muted-foreground">No check-in/check-out permissions.</p>;
  }

  const isCheckedIn = Boolean(activeQuery.data);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Check-In / Check-Out"
        description="Select branch, find a student, then record attendance."
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Student lookup</CardTitle>
          <CardDescription>
            {user?.role === ROLES.LIBRARY_OWNER
              ? 'Choose a branch, then search by name, phone, student ID, or seat number.'
              : 'Search by name, phone, student ID, or seat number.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user?.role === ROLES.LIBRARY_OWNER ? (
            <BranchSelect
              label="Branch"
              libraryId={libraryId || null}
              value={branchId}
              onChange={(id) => {
                setBranchId(id);
                setSelectedStudentId('');
                setSelectedStudent(null);
              }}
            />
          ) : (
            <BranchSelect
              label="Branch"
              libraryId={libraryId || null}
              value={branchId}
              onChange={() => {}}
              lockedLibraryId={libraryId || null}
              lockedBranchId={user?.branchId ?? branchId}
            />
          )}

          <StudentSelect
            label="Student"
            libraryId={libraryId || null}
            branchId={branchReady ? branchId : null}
            value={selectedStudentId}
            disabled={!branchReady}
            onChange={(id, student) => {
              setSelectedStudentId(id);
              setSelectedStudent(student ?? null);
            }}
          />

          {selectedStudent ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{selectedStudent.fullName}</p>
              <p className="text-muted-foreground">
                {selectedStudent.studentId}
                {selectedStudent.phone ? ` · ${selectedStudent.phone}` : ''}
              </p>
              {selectedStudent.seatNumber ? (
                <p className="text-muted-foreground">Seat {selectedStudent.seatNumber}</p>
              ) : null}
              {activeQuery.isFetching ? (
                <p className="mt-2 text-xs text-muted-foreground">Checking attendance status…</p>
              ) : isCheckedIn ? (
                <Badge className="mt-2" variant="default">
                  Checked in
                </Badge>
              ) : (
                <Badge className="mt-2" variant="secondary">
                  Not checked in today
                </Badge>
              )}
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button
              disabled={!canCheckIn || !selectedStudentId || isCheckedIn}
              loading={checkInMutation.isPending}
              onClick={() => {
                if (isCheckedIn) {
                  toast.info('Already checked in.');
                  return;
                }
                checkInMutation.mutate(selectedStudentId);
              }}
            >
              Check in
            </Button>
            <Button
              variant="outline"
              disabled={!canCheckOut || !selectedStudentId || !isCheckedIn}
              loading={checkOutMutation.isPending}
              onClick={() => checkOutMutation.mutate(selectedStudentId)}
            >
              Check out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
