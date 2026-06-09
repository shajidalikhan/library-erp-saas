'use client';

import { Badge } from '@/components/ui/badge';
import type { StudentMySeat } from '@/modules/students/types-seat';

export function StudentSeatDetails({ seat }: { seat: StudentMySeat }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Seat number', value: seat.seatNumber },
    { label: 'Floor', value: seat.floor },
    { label: 'Zone', value: seat.zone },
    { label: 'Seat type', value: seat.seatType },
    {
      label: 'Shift(s)',
      value:
        seat.shifts?.map((s) => `${s.name} (${s.startTime}–${s.endTime})`).join(', ') ||
        seat.shiftType ||
        '—',
    },
    { label: 'Status', value: seat.status },
    { label: 'Branch', value: seat.branchName ?? seat.branchCode ?? '—' },
    { label: 'Assigned', value: seat.assignedAt ? new Date(seat.assignedAt).toLocaleString() : '—' },
    { label: 'Occupancy', value: seat.occupied ? 'Occupied' : 'Available' },
  ];

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="text-xs font-medium text-muted-foreground">{row.label}</dt>
          <dd className="mt-0.5 text-sm font-medium">{row.value}</dd>
        </div>
      ))}
      {seat.notes ? (
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-muted-foreground">Notes</dt>
          <dd className="mt-0.5 text-sm text-muted-foreground">{seat.notes}</dd>
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <Badge variant={seat.occupied ? 'default' : 'secondary'}>
          {seat.occupied ? 'Currently occupied' : 'Not occupied'}
        </Badge>
      </div>
    </dl>
  );
}
