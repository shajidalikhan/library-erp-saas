'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { AttendanceBoardResponse } from '../../types-board';

export function AttendanceSummaryCards({ summary }: { summary: AttendanceBoardResponse['summary'] }) {
  const items = [
    { label: 'Assigned seats', value: summary.totalAssigned },
    { label: 'Checked in', value: summary.checkedIn + summary.late, hint: 'includes late' },
    { label: 'Checked out', value: summary.checkedOut },
    { label: 'Auto checked out', value: summary.autoCheckedOut ?? 0 },
    { label: 'Not checked in', value: summary.notCheckedIn },
    { label: 'Late', value: summary.late },
    { label: 'Active inside', value: summary.activeInside },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <Card key={item.label} className="border-border/60 shadow-soft">
          <CardHeader className="pb-1 pt-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">{item.label}</CardTitle>
          </CardHeader>
          <CardContent className="pb-3 text-2xl font-semibold tabular-nums">{item.value}</CardContent>
        </Card>
      ))}
    </div>
  );
}
