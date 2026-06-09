'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Can } from '@/components/auth/can';
import { PERMISSIONS } from '@/constants/permissions';
import { shiftApi } from '@/modules/shifts/shift.service';

export function ShiftManagementPanel({
  libraryId,
  branchId,
}: {
  libraryId: string;
  branchId: string;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('06:00');
  const [endTime, setEndTime] = useState('12:00');
  const [type, setType] = useState('MORNING');
  const [color, setColor] = useState('#3b82f6');

  const q = useQuery({
    queryKey: ['shifts', branchId],
    queryFn: () => shiftApi.list({ branchId, libraryId }),
    enabled: Boolean(libraryId && branchId),
  });

  const create = useMutation({
    mutationFn: () =>
      shiftApi.create({
        libraryId,
        branchId,
        name: name.trim(),
        startTime,
        endTime,
        type,
        color,
      }),
    onSuccess: () => {
      toast.success('Shift created');
      setName('');
      void qc.invalidateQueries({ queryKey: ['shifts', branchId] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : 'Could not create shift'),
  });

  return (
    <div className="space-y-6">
      <Can permission={PERMISSIONS.SHIFT_CREATE}>
        <Card className="max-w-xl border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Add a shift</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Morning" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="MORNING">Morning</option>
                  <option value="AFTERNOON">Afternoon</option>
                  <option value="EVENING">Evening</option>
                  <option value="NIGHT">Night</option>
                  <option value="FULL_DAY">Full day</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Color</Label>
                <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              </div>
            </div>
            <Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>
              <Plus className="mr-2 h-4 w-4" />
              Add shift
            </Button>
          </CardContent>
        </Card>
      </Can>

      <Card className="border-border/60 shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Active shifts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(q.data ?? []).map((shift) => (
            <div
              key={shift._id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <span className="inline-flex items-center gap-2 font-medium">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: shift.color ?? '#3b82f6' }}
                />
                {shift.name}
              </span>
              <span className="text-muted-foreground">
                {shift.type} · {shift.startTime} – {shift.endTime}
              </span>
            </div>
          ))}
          {!q.isLoading && !q.data?.length ? (
            <p className="text-sm text-muted-foreground">
              No shifts yet. Add Morning and Evening (or Full day) before using the seat grid.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
