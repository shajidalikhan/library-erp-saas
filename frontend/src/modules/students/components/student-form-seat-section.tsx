'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { shiftApi } from '@/modules/shifts/shift.service';
import type { Student } from '@/modules/students/types';

import { SeatSelectModal } from './admission/seat-select-modal';

export type SeatAssignmentDraft = {
  seatId: string | null;
  shiftId: string;
  touched: boolean;
};

export function resolveStudentSeatShiftId(student: Student): string {
  if (student.currentShiftId) return student.currentShiftId;
  const first = student.seatShiftAssignments?.[0];
  if (!first) return '';
  const shift = first.shiftId;
  if (typeof shift === 'string') return shift;
  if (shift && typeof shift === 'object' && '_id' in shift) return String(shift._id);
  return '';
}

function formatSeatSummary(student: Student, branchName?: string): string {
  if (!student.assignedSeatId || !student.seatNumber) return '';
  const parts = [
    student.seatNumber,
    student.shiftType,
    student.seatFloor ? `Floor ${student.seatFloor}` : null,
    student.seatZone ? `Zone ${student.seatZone}` : null,
    branchName,
  ].filter(Boolean);
  return parts.join(' · ');
}

type StudentFormSeatSectionProps = {
  student: Student;
  branchName?: string;
  draft: SeatAssignmentDraft;
  seatLabel: string;
  onDraftChange: (next: SeatAssignmentDraft) => void;
  onSeatLabelChange: (label: string) => void;
};

export function StudentFormSeatSection({
  student,
  branchName,
  draft,
  seatLabel,
  onDraftChange,
  onSeatLabelChange,
}: StudentFormSeatSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const { data: shifts = [] } = useQuery({
    queryKey: ['student-form-shifts', student.branchId],
    queryFn: () => shiftApi.list({ branchId: student.branchId, active: 'true' }),
    enabled: Boolean(student.branchId),
  });

  const summary = useMemo(() => {
    if (!draft.seatId) return null;
    if (draft.touched && seatLabel) {
      const shiftName = shifts.find((s) => s._id === draft.shiftId)?.name;
      return [
        seatLabel,
        shiftName,
        student.seatFloor ? `Floor ${student.seatFloor}` : null,
        student.seatZone ? `Zone ${student.seatZone}` : null,
        branchName,
      ]
        .filter(Boolean)
        .join(' · ');
    }
    return formatSeatSummary(student, branchName);
  }, [draft, seatLabel, shifts, student, branchName]);

  return (
    <Card className="border-border/60 shadow-soft">
      <CardHeader>
        <CardTitle className="text-lg">Seat assignment</CardTitle>
        <CardDescription>Assign or change the member&apos;s seat and shift.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {draft.seatId && summary ? (
          <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium">{summary}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No seat assigned</p>
        )}

        <div className="space-y-2">
          <Label htmlFor="seat-shift">Shift</Label>
          <select
            id="seat-shift"
            className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
            value={draft.shiftId}
            onChange={(e) =>
              onDraftChange({ ...draft, shiftId: e.target.value, touched: true })
            }
          >
            <option value="">Select shift…</option>
            {shifts.map((sh) => (
              <option key={sh._id} value={sh._id}>
                {sh.name} ({sh.startTime}–{sh.endTime})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!draft.shiftId}
            onClick={() => setModalOpen(true)}
          >
            {draft.seatId ? 'Change seat' : 'Choose seat'}
          </Button>
          {draft.seatId ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onDraftChange({ seatId: null, shiftId: draft.shiftId, touched: true });
                onSeatLabelChange('');
              }}
            >
              Unassign seat
            </Button>
          ) : null}
        </div>

        <SeatSelectModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          branchId={student.branchId}
          shiftId={draft.shiftId}
          selectedSeatId={draft.seatId ?? ''}
          onSelect={(seat) => {
            onDraftChange({ ...draft, seatId: seat._id, touched: true });
            onSeatLabelChange(seat.seatNumber);
            setModalOpen(false);
          }}
        />
      </CardContent>
    </Card>
  );
}
