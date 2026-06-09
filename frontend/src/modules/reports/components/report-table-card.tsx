'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/common/empty-state';
import { formatEntityLabel } from '@/lib/entity-label';

const DISPLAY_KEY_ALIASES: Record<string, string[]> = {
  branchId: ['branchName', 'branchCode'],
  libraryId: ['libraryName', 'librarySlug'],
  studentId: ['studentName', 'studentCode', 'fullName'],
  studentCode: ['studentId', 'fullName'],
  assignedStudentId: ['studentName', 'studentCode'],
  assignedSeatId: ['seatNumber', 'seatFloor', 'seatZone'],
  seatId: ['seatNumber', 'seatFloor', 'seatZone'],
  recipientUserId: ['recipientName', 'recipientEmail'],
  actorUserId: ['actorName', 'actorEmail'],
  createdBy: ['createdByName', 'createdByEmail'],
  receivedBy: ['receivedByName', 'receivedByEmail'],
  invoiceId: ['invoiceNumber'],
};

const looksLikeObjectId = (value: string) => /^[a-f0-9]{24}$/i.test(value);

export function ReportTableCard({
  title,
  columns,
  rows,
  page,
  totalPages,
  onPageChange,
  emptyLabel,
}: {
  title: string;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  emptyLabel?: string;
}) {
  const cell = (row: Record<string, unknown>, key: string) => {
    const aliases = DISPLAY_KEY_ALIASES[key];
    if (aliases) {
      const label = aliases
        .map((alias) => row[alias])
        .filter((value) => value !== null && value !== undefined && String(value).trim())
        .map((value) => String(value))
        .join(' · ');
      if (label) return label;
    }

    const v = row[key];
    if (v === null || v === undefined) return '—';
    if (typeof v === 'object') return JSON.stringify(v);
    const text = String(v);
    if (looksLikeObjectId(text)) {
      if (key.endsWith('Id')) {
        if (key.includes('branch')) return formatEntityLabel(null, 'branch');
        if (key.includes('student')) return formatEntityLabel(null, 'student');
        if (key.includes('library')) return formatEntityLabel(null, 'library');
        if (key.includes('seat')) return formatEntityLabel(null, 'seat');
        if (key.includes('user') || key.includes('actor') || key.includes('recipient')) {
          return formatEntityLabel(null, 'user');
        }
      }
      return '—';
    }
    return text;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} / {Math.max(totalPages, 1)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyState title={emptyLabel ?? 'No rows'} description="Try another date range or filters." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.key} className="whitespace-nowrap text-xs">
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow key={String(row._id ?? idx)}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className="max-w-[220px] truncate text-xs">
                      {cell(row, c.key)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
