'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS } from '@/constants/permissions';
import { seatDetailRoute } from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { ApiError } from '@/lib/api-error';
import { seatApi } from '@/modules/seats/seat.service';
import { seatQueryKeys } from '@/modules/seats/seat-query-keys';
import { seatEditFormSchema, type SeatEditFormValues } from '@/modules/seats/schemas';

export default function EditSeatPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const seatId = String(params.seatId ?? '');
  const { can } = usePermissions();

  const { data: seat, isLoading } = useQuery({
    queryKey: seatQueryKeys.detail(seatId),
    queryFn: () => seatApi.get(seatId),
    enabled: Boolean(seatId) && can(PERMISSIONS.SEAT_UPDATE),
  });

  const form = useForm<SeatEditFormValues>({
    resolver: zodResolver(seatEditFormSchema),
    values: seat
      ? {
          seatNumber: seat.seatNumber,
          floor: seat.floor,
          zone: seat.zone,
          seatType: seat.seatType,
          notes: seat.notes ?? '',
          status: seat.status,
          active: seat.active,
          reservedUntil: seat.reservedUntil
            ? new Date(seat.reservedUntil).toISOString().slice(0, 16)
            : '',
        }
      : undefined,
  });

  if (!can(PERMISSIONS.SEAT_UPDATE)) {
    return <p className="text-sm text-muted-foreground">No access.</p>;
  }

  if (isLoading || !seat) {
    return <Skeleton className="h-96 w-full max-w-lg" />;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const body: Record<string, unknown> = {
        seatNumber: values.seatNumber,
        floor: values.floor,
        zone: values.zone,
        seatType: values.seatType,
        notes: values.notes || undefined,
        status: values.status,
        active: values.active,
        reservedUntil: values.reservedUntil ? new Date(values.reservedUntil).toISOString() : null,
      };
      await seatApi.update(seatId, body);
      toast.success('Seat updated');
      await qc.invalidateQueries({ queryKey: seatQueryKeys.detail(seatId) });
      router.push(seatDetailRoute(seatId));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed');
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${seat.seatNumber}`}
        actions={
          <Button variant="outline" asChild>
            <Link href={seatDetailRoute(seatId)}>Cancel</Link>
          </Button>
        }
      />
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Seat</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label>Seat number</Label>
              <Input {...form.register('seatNumber')} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Floor</Label>
                <Input {...form.register('floor')} />
              </div>
              <div className="space-y-2">
                <Label>Zone</Label>
                <Input {...form.register('zone')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...form.register('seatType')}
              >
                <option value="STANDARD">STANDARD</option>
                <option value="PREMIUM">PREMIUM</option>
                <option value="CABIN">CABIN</option>
                <option value="SILENT_ZONE">SILENT_ZONE</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...form.register('status')}
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="OCCUPIED">OCCUPIED</option>
                <option value="RESERVED">RESERVED</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
                <option value="BLOCKED">BLOCKED</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Reservation until (optional)</Label>
              <Input type="datetime-local" {...form.register('reservedUntil')} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input {...form.register('notes')} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.watch('active')}
                onChange={(e) => form.setValue('active', e.target.checked)}
              />
              Active
            </label>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Save
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
