'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Columns3, Eye } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { attendanceStudentHistoryRoute } from '@/constants/routes';
import { cn } from '@/lib/utils';

import {
  formatBoardCheckInTime,
  formatBoardCheckOutTime,
  formatBoardDuration,
} from '../../format-duration.util';
import type { AttendanceBoardStudent, StudentColumnKey } from '../../types-board';
import { DEFAULT_STUDENT_COLUMNS, isStudentCheckedIn, STUDENT_COLUMN_KEYS } from '../../types-board';
import { BoardAttendanceStatusBadge } from './board-attendance-status-badge';
import type { AttendanceStatusFilter } from './attendance-filters';

const COLUMN_LABELS: Record<StudentColumnKey, string> = {
  photo: 'Photo',
  name: 'Name',
  code: 'Code',
  phone: 'Phone',
  seat: 'Seat',
  shift: 'Shift',
  membership: 'Membership',
  status: 'Status',
  checkIn: 'Check-in',
  checkOut: 'Check-out',
  duration: 'Duration',
  actions: 'Actions',
};

const STORAGE_KEY = 'attendance-board-columns';

function filterStudents(
  students: AttendanceBoardStudent[],
  search: string,
  statusFilter: AttendanceStatusFilter,
  shiftId: string,
): AttendanceBoardStudent[] {
  const q = search.trim().toLowerCase();
  return students.filter((s) => {
    if (shiftId && s.shiftId !== shiftId) return false;
    if (statusFilter === 'checked_in') {
      if (s.attendanceStatus !== 'CHECKED_IN' && s.attendanceStatus !== 'LATE') return false;
    } else if (statusFilter === 'checked_out' && s.attendanceStatus !== 'CHECKED_OUT') return false;
    else if (statusFilter === 'auto_checked_out' && s.attendanceStatus !== 'CHECKED_OUT_AUTO') return false;
    else if (statusFilter === 'not_checked_in' && s.attendanceStatus !== 'NOT_CHECKED_IN') return false;
    else if (statusFilter === 'late' && s.attendanceStatus !== 'LATE') return false;

    if (!q) return true;
    return (
      s.studentName.toLowerCase().includes(q) ||
      s.studentCode.toLowerCase().includes(q) ||
      (s.phone ?? '').includes(q) ||
      (s.seatNumber ?? '').toLowerCase().includes(q)
    );
  });
}

export function AttendanceStudentsView({
  students,
  search,
  statusFilter,
  shiftId,
  onSelectStudent,
  onCheckIn,
  onCheckOut,
}: {
  students: AttendanceBoardStudent[];
  search: string;
  statusFilter: AttendanceStatusFilter;
  shiftId: string;
  onSelectStudent: (s: AttendanceBoardStudent) => void;
  onCheckIn: (s: AttendanceBoardStudent) => void;
  onCheckOut: (s: AttendanceBoardStudent) => void;
}) {
  const [columns, setColumns] = useState<StudentColumnKey[]>(DEFAULT_STUDENT_COLUMNS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StudentColumnKey[];
        if (Array.isArray(parsed) && parsed.length) setColumns(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persistColumns = (next: StudentColumnKey[]) => {
    setColumns(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const visible = useMemo(
    () => filterStudents(students, search, statusFilter, shiftId),
    [students, search, statusFilter, shiftId],
  );

  const show = (key: StudentColumnKey) => columns.includes(key);

  if (!visible.length) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No students match your filters.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Columns3 className="mr-2 h-4 w-4" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {STUDENT_COLUMN_KEYS.map((key) => (
              <DropdownMenuCheckboxItem
                key={key}
                checked={columns.includes(key)}
                onCheckedChange={(checked) => {
                  const next = checked
                    ? [...columns, key]
                    : columns.filter((c) => c !== key);
                  if (next.length) persistColumns(next);
                }}
              >
                {COLUMN_LABELS[key]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {show('photo') ? <TableHead className="w-12" /> : null}
              {show('name') ? <TableHead>Name</TableHead> : null}
              {show('code') ? <TableHead>Code</TableHead> : null}
              {show('phone') ? <TableHead>Phone</TableHead> : null}
              {show('seat') ? <TableHead>Seat</TableHead> : null}
              {show('shift') ? <TableHead>Shift</TableHead> : null}
              {show('membership') ? <TableHead>Membership</TableHead> : null}
              {show('status') ? <TableHead>Status</TableHead> : null}
              {show('checkIn') ? <TableHead>Check-in</TableHead> : null}
              {show('checkOut') ? <TableHead>Check-out</TableHead> : null}
              {show('duration') ? <TableHead>Duration</TableHead> : null}
              {show('actions') ? <TableHead className="text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((s) => {
              const inside = isStudentCheckedIn(s);
              return (
                <TableRow
                  key={s.studentId}
                  className={cn(
                    'cursor-pointer hover:bg-muted/50',
                    s.attendanceStatus === 'CHECKED_IN' && 'bg-blue-500/5',
                    s.attendanceStatus === 'LATE' && 'bg-orange-500/5',
                    s.attendanceStatus === 'NOT_CHECKED_IN' && 'bg-amber-500/5',
                  )}
                  onClick={() => onSelectStudent(s)}
                >
                  {show('photo') ? (
                    <TableCell>
                      <Avatar className="h-9 w-9">
                        {s.photoUrl ? <AvatarImage src={s.photoUrl} alt="" /> : null}
                        <AvatarFallback className="text-xs">
                          {s.studentName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                  ) : null}
                  {show('name') ? <TableCell className="font-medium">{s.studentName}</TableCell> : null}
                  {show('code') ? (
                    <TableCell className="font-mono text-xs">{s.studentCode}</TableCell>
                  ) : null}
                  {show('phone') ? <TableCell>{s.phone ?? '—'}</TableCell> : null}
                  {show('seat') ? <TableCell>{s.seatNumber ?? '—'}</TableCell> : null}
                  {show('shift') ? <TableCell>{s.shiftName ?? '—'}</TableCell> : null}
                  {show('membership') ? (
                    <TableCell>
                      <span className="text-xs">{s.membershipStatus}</span>
                    </TableCell>
                  ) : null}
                  {show('status') ? (
                    <TableCell>
                      <BoardAttendanceStatusBadge status={s.attendanceStatus} />
                    </TableCell>
                  ) : null}
                  {show('checkIn') ? <TableCell>{formatBoardCheckInTime(s.checkInAt)}</TableCell> : null}
                  {show('checkOut') ? <TableCell>{formatBoardCheckOutTime(s)}</TableCell> : null}
                  {show('duration') ? <TableCell>{formatBoardDuration(s)}</TableCell> : null}
                  {show('actions') ? (
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {inside ? (
                          <Button size="sm" variant="secondary" onClick={() => onCheckOut(s)}>
                            Check out
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => onCheckIn(s)}>
                            Check in
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={attendanceStudentHistoryRoute(s.studentId)}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
