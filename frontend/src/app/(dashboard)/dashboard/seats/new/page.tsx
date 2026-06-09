'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Can } from '@/components/auth/can';
import { PERMISSIONS, ROLES } from '@/constants/permissions';
import { ROUTES, seatDetailRoute } from '@/constants/routes';
import { useDebounce } from '@/hooks/use-debounce';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/store/auth.store';
import { ApiError } from '@/lib/api-error';
import { libraryApi } from '@/modules/library/library.service';
import { seatApi } from '@/modules/seats/seat.service';
import { seatCreateFormSchema, type SeatCreateFormValues } from '@/modules/seats/schemas';

export default function NewSeatPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const isSuper = user?.role === ROLES.SUPER_ADMIN;
  const [libSearch, setLibSearch] = useState('');
  const debouncedLibSearch = useDebounce(libSearch, 300);
  const defaultLib = !isSuper ? (user?.libraryId ?? '') : '';
  const defaultBranch =
    user?.role === ROLES.MANAGER || user?.role === ROLES.RECEPTIONIST
      ? (user?.branchId ?? '')
      : '';

  const { data: libs } = useQuery({
    queryKey: ['seat-new-libs', debouncedLibSearch],
    queryFn: () => libraryApi.listLibraries({ limit: 50, search: debouncedLibSearch || undefined }),
    enabled: isSuper && can(PERMISSIONS.SEAT_CREATE),
  });

  const form = useForm<SeatCreateFormValues>({
    resolver: zodResolver(seatCreateFormSchema) as import('react-hook-form').Resolver<SeatCreateFormValues>,
    defaultValues: {
      libraryId: defaultLib,
      branchId: defaultBranch,
      seatNumber: '',
      floor: '1',
      zone: 'General',
      seatType: 'STANDARD',
      notes: '',
      status: 'AVAILABLE',
      active: true,
    },
  });

  const libraryIdWatch = form.watch('libraryId');

  const { data: branches } = useQuery({
    queryKey: ['seat-new-branches', libraryIdWatch],
    queryFn: () => libraryApi.listBranches(libraryIdWatch, { limit: 100 }),
    enabled: Boolean(libraryIdWatch),
  });

  useEffect(() => {
    const items = branches?.items;
    if (!items?.length) return;
    const current = form.getValues('branchId');
    if (current && items.some((b) => b._id === current)) return;
    if (defaultBranch && items.some((b) => b._id === defaultBranch)) {
      form.setValue('branchId', defaultBranch);
      return;
    }
    if (items.length === 1) form.setValue('branchId', items[0]._id);
  }, [branches?.items, defaultBranch, form]);

  if (!can(PERMISSIONS.SEAT_CREATE)) {
    return <p className="text-sm text-muted-foreground">No permission to create seats.</p>;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const payload = {
        ...values,
        notes: values.notes || undefined,
      };
      const seat = await seatApi.create(payload as Record<string, unknown>);
      toast.success('Seat created');
      router.push(seatDetailRoute(seat._id));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed');
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add seat"
        actions={
          <Button variant="outline" asChild>
            <Link href={ROUTES.SEATS}>Back</Link>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4 max-w-lg" onSubmit={onSubmit}>
            {isSuper ? (
              <>
                <div className="space-y-2">
                  <Label>Library search</Label>
                  <Input value={libSearch} onChange={(e) => setLibSearch(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Library</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    {...form.register('libraryId')}
                  >
                    <option value="">Select…</option>
                    {libs?.items.map((l) => (
                      <option key={l._id} value={l._id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}
            <div className="space-y-2">
              <Label>Branch</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...form.register('branchId')}
                disabled={isSuper && !libraryIdWatch}
              >
                <option value="">Select branch…</option>
                {branches?.items.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.branchName} ({b.branchCode})
                  </option>
                ))}
              </select>
            </div>
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
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>
            <p className="text-xs text-muted-foreground">
              Seats are shift-neutral. Assign students per shift from the occupancy grid.
            </p>
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...form.register('status')}
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="RESERVED">RESERVED</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
                <option value="BLOCKED">BLOCKED</option>
              </select>
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
            <Can permission={PERMISSIONS.SEAT_CREATE}>
              <Button type="submit" loading={form.formState.isSubmitting}>
                Create seat
              </Button>
            </Can>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
