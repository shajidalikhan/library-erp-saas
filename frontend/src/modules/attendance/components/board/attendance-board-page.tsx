'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, List, QrCode } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS, ROLES } from '@/constants/permissions';
import { attendanceCheckInRoute } from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { usePreferredBranch } from '@/hooks/use-preferred-branch';
import { useTenantScope } from '@/hooks/use-tenant-scope';
import { ApiError } from '@/lib/api-error';
import { useAuthStore } from '@/store/auth.store';
import { libraryApi } from '@/modules/library/library.service';
import {
  patchBoardAfterCheckIn,
  patchBoardAfterCheckOut,
  patchBoardStudentAfterCheckIn,
  patchBoardStudentAfterCheckOut,
} from '@/modules/attendance/attendance-cache.util';
import { attendanceApi } from '@/modules/attendance/attendance.service';
import { attendanceQueryKeys } from '@/modules/attendance/attendance-query-keys';

import type { AttendanceBoardGridCell, AttendanceBoardResponse, AttendanceBoardStudent } from '../../types-board';
import { isStudentCheckedIn } from '../../types-board';
import { AttendanceActionDialog } from './attendance-action-dialog';
import { AttendanceFilters, type AttendanceStatusFilter } from './attendance-filters';
import { AttendanceSeatGridView } from './attendance-seat-grid-view';
import { AttendanceStudentsView } from './attendance-students-view';
import { AttendanceSummaryCards } from './attendance-summary-cards';

type ViewMode = 'students' | 'grid';

const BRANCH_STAFF = new Set<string>([ROLES.MANAGER, ROLES.RECEPTIONIST, ROLES.SECURITY]);

export function AttendanceBoardPage() {
  const { canAny } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const { effectiveLibraryId, effectiveBranchId, requiresLibrarySelection } = useTenantScope();
  const qc = useQueryClient();

  const isSuper = user?.role === ROLES.SUPER_ADMIN;
  const isBranchStaff = user?.role ? BRANCH_STAFF.has(user.role) : false;
  const branchLocked = isBranchStaff && Boolean(user?.branchId);

  const libraryId = isSuper ? effectiveLibraryId : user?.libraryId ?? '';

  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['attendance-board-branches', libraryId],
    queryFn: () => libraryApi.listBranches(libraryId!, { limit: 100 }),
    enabled: Boolean(libraryId) && canAny([PERMISSIONS.BRANCH_READ, PERMISSIONS.ATTENDANCE_READ]),
  });

  const branches = branchesData?.items ?? [];
  const [localBranchId, setLocalBranchId] = usePreferredBranch(libraryId, branches, {
    fixedBranchId: branchLocked ? user?.branchId ?? undefined : undefined,
  });
  const branchId = isSuper
    ? effectiveBranchId || localBranchId
    : branchLocked
      ? user?.branchId ?? ''
      : localBranchId;

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [shiftId, setShiftId] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('students');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AttendanceStatusFilter>('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<AttendanceBoardStudent | null>(null);
  const [selectedCell, setSelectedCell] = useState<AttendanceBoardGridCell | null>(null);

  const boardParams = useMemo(
    () => ({
      libraryId: isSuper ? libraryId || undefined : undefined,
      branchId: branchId || undefined,
      date: date ? new Date(`${date}T12:00:00`).toISOString() : undefined,
      shiftId: shiftId || undefined,
      mode: viewMode,
    }),
    [isSuper, libraryId, branchId, date, shiftId, viewMode],
  );

  const boardQuery = useQuery({
    queryKey: attendanceQueryKeys.board(boardParams),
    queryFn: () => attendanceApi.board(boardParams),
    enabled: Boolean(branchId) && canAny([PERMISSIONS.ATTENDANCE_READ]),
  });

  const refetchBoard = async () => {
    await qc.refetchQueries({ queryKey: attendanceQueryKeys.board(boardParams) });
  };

  const syncBoard = () => {
    void qc.invalidateQueries({ queryKey: attendanceQueryKeys.all });
  };

  const handleCheckIn = (s: AttendanceBoardStudent) => {
    if (isStudentCheckedIn(s)) {
      toast.info('Already checked in.');
      return;
    }
    checkInMutation.mutate(s);
  };

  const handleCheckOut = (s: AttendanceBoardStudent) => {
    checkOutMutation.mutate(s);
  };

  const checkInMutation = useMutation({
    mutationFn: (s: AttendanceBoardStudent) =>
      attendanceApi.checkIn({
        studentId: s.studentId,
        libraryId: libraryId || undefined,
        branchId: branchId || undefined,
        ...(s.seatId ? { seatId: s.seatId } : {}),
      }),
    onSuccess: (attendance) => {
      toast.success('Checked in');
      qc.setQueryData(attendanceQueryKeys.board(boardParams), (old: AttendanceBoardResponse | undefined) =>
        patchBoardAfterCheckIn(old, attendance),
      );
      setSelectedStudent((prev) =>
        prev ? patchBoardStudentAfterCheckIn(prev, attendance) : prev,
      );
      syncBoard();
      setDialogOpen(false);
    },
    onError: async (e) => {
      if (e instanceof ApiError && e.statusCode === 409) {
        toast.info('Student is already checked in.');
        await refetchBoard();
        return;
      }
      toast.error(e instanceof ApiError ? e.message : 'Check-in failed');
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: (s: AttendanceBoardStudent) =>
      attendanceApi.checkOut({
        studentId: s.studentId,
        libraryId: libraryId || undefined,
        branchId: branchId || undefined,
      }),
    onSuccess: (attendance) => {
      toast.success('Checked out');
      qc.setQueryData(attendanceQueryKeys.board(boardParams), (old: AttendanceBoardResponse | undefined) =>
        patchBoardAfterCheckOut(old, attendance),
      );
      setSelectedStudent((prev) =>
        prev ? patchBoardStudentAfterCheckOut(prev, attendance) : prev,
      );
      syncBoard();
      setDialogOpen(false);
    },
    onError: async (e) => {
      const message = e instanceof ApiError ? e.message : 'Check-out failed';
      if (e instanceof ApiError && /no active check-in/i.test(message)) {
        toast.info('No active check-in found. Refreshing attendance status.');
        await refetchBoard();
        setDialogOpen(false);
        return;
      }
      toast.error(message);
    },
  });

  const openStudent = (s: AttendanceBoardStudent, cell?: AttendanceBoardGridCell | null) => {
    setSelectedStudent(s);
    setSelectedCell(cell ?? null);
    setDialogOpen(true);
  };

  const openCell = (cell: AttendanceBoardGridCell) => {
    if (!cell.student || !boardQuery.data) return;
    const full = boardQuery.data.students.find((s) => s.studentId === cell.student!.studentId);
    if (full) openStudent(full, cell);
  };

  if (!canAny([PERMISSIONS.ATTENDANCE_READ])) {
    return <EmptyState title="No access" description="You cannot view attendance." />;
  }

  if (requiresLibrarySelection) {
    return (
      <EmptyState
        title="Select a library"
        description="Use the workspace bar above to choose a library and branch for attendance."
      />
    );
  }

  const needsBranchPick = !branchId && branches.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Mark daily attendance by student list or seat grid."
        actions={
          <Button variant="outline" asChild>
            <Link href={attendanceCheckInRoute()}>
              <QrCode className="mr-2 h-4 w-4" />
              QR check-in
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/50 p-4">
        {needsBranchPick ? (
          <div className="min-w-[200px] flex-1 space-y-1">
            <Label className="text-xs">Branch</Label>
            <select
              className="flex h-9 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
              value={localBranchId}
              onChange={(e) => setLocalBranchId(e.target.value)}
            >
              <option value="">Select branch…</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.branchName}
                </option>
              ))}
            </select>
          </div>
        ) : branchId ? (
          <p className="text-sm text-muted-foreground pb-2">
            Branch: {branches.find((b) => b._id === branchId)?.branchName ?? '—'}
          </p>
        ) : null}
        <div className="space-y-1">
          <Label htmlFor="att-date" className="text-xs">
            Date
          </Label>
          <Input
            id="att-date"
            type="date"
            className="h-9 w-[10.5rem]"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="flex gap-1 pb-0.5">
          <Button
            type="button"
            size="sm"
            variant={viewMode === 'students' ? 'default' : 'outline'}
            onClick={() => setViewMode('students')}
          >
            <List className="mr-1 h-4 w-4" />
            Students
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="mr-1 h-4 w-4" />
            Seat grid
          </Button>
        </div>
      </div>

      {needsBranchPick ? (
        <EmptyState
          title="Select a branch"
          description="Choose a branch in the workspace bar or below to load today’s attendance board."
        />
      ) : branchesLoading || boardQuery.isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : boardQuery.isError ? (
        <EmptyState title="Could not load board" description="Try again or pick another branch." />
      ) : boardQuery.data ? (
        <>
          <AttendanceSummaryCards summary={boardQuery.data.summary} />
          <AttendanceFilters
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            shiftId={shiftId}
            onShiftChange={setShiftId}
            shifts={boardQuery.data.shifts}
          />
          {viewMode === 'students' ? (
            <AttendanceStudentsView
              students={boardQuery.data.students}
              search={search}
              statusFilter={statusFilter}
              shiftId={shiftId}
              onSelectStudent={(s) => openStudent(s)}
              onCheckIn={handleCheckIn}
              onCheckOut={handleCheckOut}
            />
          ) : (
            <AttendanceSeatGridView
              board={boardQuery.data}
              shiftFilter={shiftId}
              onCellClick={openCell}
            />
          )}
        </>
      ) : null}

      <AttendanceActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        student={selectedStudent}
        cell={selectedCell}
        onCheckIn={() => selectedStudent && handleCheckIn(selectedStudent)}
        onCheckOut={() => selectedStudent && handleCheckOut(selectedStudent)}
        checkingIn={checkInMutation.isPending}
        checkingOut={checkOutMutation.isPending}
      />
    </div>
  );
}
