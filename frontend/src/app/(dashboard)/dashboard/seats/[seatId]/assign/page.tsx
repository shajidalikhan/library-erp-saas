'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Can } from '@/components/auth/can';
import { PERMISSIONS } from '@/constants/permissions';
import { seatDetailRoute } from '@/constants/routes';
import { useDebounce } from '@/hooks/use-debounce';
import { usePermissions } from '@/hooks/use-permissions';
import { ApiError } from '@/lib/api-error';
import { seatApi } from '@/modules/seats/seat.service';
import { seatQueryKeys } from '@/modules/seats/seat-query-keys';
import { studentApi } from '@/modules/students/student.service';
import { shiftApi } from '@/modules/shifts/shift.service';

const schema = z.object({
  studentId: z.string().min(1, 'Select a student'),
  shiftId: z.string().min(1, 'Select a shift'),
});

export default function AssignSeatPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const seatId = String(params.seatId ?? '');
  const { can } = usePermissions();
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);

  const { data: seat } = useQuery({
    queryKey: seatQueryKeys.detail(seatId),
    queryFn: () => seatApi.get(seatId),
    enabled: Boolean(seatId) && can(PERMISSIONS.SEAT_ASSIGN),
  });

  const { data: shifts } = useQuery({
    queryKey: ['shifts-assign', seat?.branchId, seat?.libraryId],
    queryFn: () =>
      shiftApi.list({
        branchId: seat!.branchId,
        libraryId: seat!.libraryId,
        active: 'true',
      }),
    enabled: Boolean(seat?.branchId && seat?.libraryId),
  });

  const listParams = useMemo(
    () => ({
      page: 1,
      limit: 30,
      search: debounced.trim() || undefined,
      branchId: seat?.branchId,
    }),
    [debounced, seat?.branchId],
  );

  const { data: studentsPage } = useQuery({
    queryKey: ['seat-assign-students', listParams],
    queryFn: () => studentApi.list(listParams as Parameters<typeof studentApi.list>[0]),
    enabled: Boolean(seat?.branchId) && can(PERMISSIONS.SEAT_ASSIGN),
  });

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { studentId: '', shiftId: '' },
  });

  if (!can(PERMISSIONS.SEAT_ASSIGN)) {
    return <p className="text-sm text-muted-foreground">No permission.</p>;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await seatApi.assign(seatId, values.studentId, values.shiftId);
      toast.success('Assigned');
      await qc.invalidateQueries({ queryKey: seatQueryKeys.all });
      router.push(seatDetailRoute(seatId));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Assign failed');
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assign seat"
        description={seat ? `Seat ${seat.seatNumber} · ${seat.zone}` : 'Loading…'}
        actions={
          <Button variant="outline" asChild>
            <Link href={seatDetailRoute(seatId)}>Back</Link>
          </Button>
        }
      />
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label>Shift</Label>
              <select
                className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                {...form.register('shiftId')}
              >
                <option value="">Select shift</option>
                {(shifts ?? []).map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.startTime}–{s.endTime})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Search student</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or ID" />
            </div>
            <div className="space-y-1.5">
              <Label>Student</Label>
              <select
                className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
                {...form.register('studentId')}
              >
                <option value="">Select student</option>
                {(studentsPage?.items ?? []).map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.fullName} ({s.studentId})
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">Assign to shift</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
