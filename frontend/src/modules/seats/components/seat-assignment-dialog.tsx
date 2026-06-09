'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, UserMinus } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebounce } from '@/hooks/use-debounce';
import { mediaUrlFromField } from '@/lib/media-url';
import { studentApi } from '@/modules/students/student.service';
import { seatAssignmentApi } from '@/modules/seats/seat.service';
import type { SeatGridCell, SeatGridSeat, SeatGridShift } from '@/modules/seats/types';

export interface SeatAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  libraryId?: string;
  seat: SeatGridSeat;
  shift: SeatGridShift;
  cell: SeatGridCell;
  onSuccess: () => void;
}

export function SeatAssignmentDialog({
  open,
  onOpenChange,
  branchId,
  libraryId,
  seat,
  shift,
  cell,
  onSuccess,
}: SeatAssignmentDialogProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [selectedStudentId, setSelectedStudentId] = useState('');

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedStudentId('');
    }
  }, [open]);

  const studentsQ = useQuery({
    queryKey: ['assign-students', branchId, debouncedSearch],
    queryFn: () =>
      studentApi.list({
        branchId,
        libraryId,
        search: debouncedSearch.trim() || undefined,
        status: 'ACTIVE',
        limit: 20,
        page: 1,
      }),
    enabled: open && cell.state === 'AVAILABLE',
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      seatAssignmentApi.create({
        seatId: seat._id,
        studentId: selectedStudentId,
        shiftId: shift._id,
      }),
    onSuccess: () => {
      toast.success('Seat assigned');
      onSuccess();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || 'Assignment failed'),
  });

  const unassignMutation = useMutation({
    mutationFn: () => seatAssignmentApi.remove(cell.assignmentId!),
    onSuccess: () => {
      toast.success('Assignment removed');
      onSuccess();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || 'Could not unassign'),
  });

  const occupied = cell.state === 'OCCUPIED' || cell.state === 'RESERVED';
  const blocked = cell.state === 'BLOCKED';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Seat {seat.seatNumber} · {shift.name}
          </DialogTitle>
          <DialogDescription>
            {shift.startTime} – {shift.endTime} · Floor {seat.floor}, {seat.zone}
          </DialogDescription>
        </DialogHeader>

        {blocked ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {cell.conflictReason ?? 'This shift cannot be assigned on this seat.'}
          </p>
        ) : null}

        {occupied && cell.student ? (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium text-muted-foreground">Current assignment</p>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={cell.student.profilePhotoUrl ?? undefined} alt={cell.student.fullName} />
                <AvatarFallback>
                  {cell.student.fullName
                    .split(/\s+/)
                    .map((p) => p[0])
                    .join('')
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium">{cell.student.fullName}</p>
                <p className="text-sm text-muted-foreground font-mono">{cell.student.studentCode}</p>
                {cell.student.phone ? (
                  <p className="text-sm text-muted-foreground">{cell.student.phone}</p>
                ) : null}
                {cell.student.membershipEndDate ? (
                  <p className="text-xs text-muted-foreground">
                    Valid until {cell.student.membershipEndDate.slice(0, 10)}
                  </p>
                ) : null}
              </div>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={unassignMutation.isPending}
              onClick={() => unassignMutation.mutate()}
            >
              {unassignMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserMinus className="mr-2 h-4 w-4" />
              )}
              Unassign
            </Button>
          </div>
        ) : null}

        {!blocked && !occupied ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="stu-search">Search student</Label>
              <Input
                id="stu-search"
                placeholder="Name, phone, student code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-1">
              {studentsQ.isLoading ? (
                <p className="p-3 text-sm text-muted-foreground">Loading students…</p>
              ) : !studentsQ.data?.items.length ? (
                <p className="p-3 text-sm text-muted-foreground">No active students found.</p>
              ) : (
                studentsQ.data.items.map((s) => {
                  const photo = mediaUrlFromField(s.profilePhoto);
                  const selected = selectedStudentId === s._id;
                  return (
                    <button
                      key={s._id}
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                        selected ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedStudentId(s._id)}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={photo} alt={s.fullName} />
                        <AvatarFallback className="text-xs">
                          {s.fullName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{s.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground font-mono">{s.studentId}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!blocked && !occupied ? (
            <Button
              type="button"
              disabled={!selectedStudentId || assignMutation.isPending}
              onClick={() => assignMutation.mutate()}
            >
              {assignMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Assign seat
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
