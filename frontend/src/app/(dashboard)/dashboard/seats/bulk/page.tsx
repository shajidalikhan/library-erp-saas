'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PERMISSIONS, ROLES } from '@/constants/permissions';
import { ROUTES } from '@/constants/routes';
import { useDebounce } from '@/hooks/use-debounce';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/store/auth.store';
import { ApiError } from '@/lib/api-error';
import { libraryApi } from '@/modules/library/library.service';
import { seatApi } from '@/modules/seats/seat.service';
import { bulkSeatFormSchema, type BulkSeatFormValues } from '@/modules/seats/schemas';

export default function BulkSeatsPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const isSuper = user?.role === ROLES.SUPER_ADMIN;
  const [libSearch, setLibSearch] = useState('');
  const debouncedLibSearch = useDebounce(libSearch, 300);

  const { data: libs } = useQuery({
    queryKey: ['bulk-seats-libs', debouncedLibSearch],
    queryFn: () => libraryApi.listLibraries({ limit: 50, search: debouncedLibSearch || undefined }),
    enabled: isSuper && can(PERMISSIONS.SEAT_BULK_CREATE),
  });

  const form = useForm<BulkSeatFormValues>({
    resolver: zodResolver(bulkSeatFormSchema) as import('react-hook-form').Resolver<BulkSeatFormValues>,
    defaultValues: {
      libraryId: !isSuper ? (user?.libraryId ?? '') : '',
      branchId:
        user?.role === ROLES.MANAGER || user?.role === ROLES.RECEPTIONIST
          ? (user?.branchId ?? '')
          : '',
      prefix: '',
      startNumber: 1,
      endNumber: 20,
      floor: '1',
      zone: 'General',
      seatType: 'STANDARD',
      padLength: 0,
    },
  });

  const libraryIdWatch = form.watch('libraryId');

  const { data: branches } = useQuery({
    queryKey: ['bulk-seat-branches', libraryIdWatch],
    queryFn: () => libraryApi.listBranches(libraryIdWatch, { limit: 100 }),
    enabled: Boolean(libraryIdWatch),
  });

  if (!can(PERMISSIONS.SEAT_BULK_CREATE)) {
    return <p className="text-sm text-muted-foreground">No permission.</p>;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await seatApi.bulkCreate(values as Record<string, unknown>);
      toast.success(`Created ${res.createdCount} seats`);
      router.push(ROUTES.SEATS);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Bulk create failed');
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk seat creation"
        actions={
          <Button variant="outline" asChild>
            <Link href={ROUTES.SEATS}>Back</Link>
          </Button>
        }
      />
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Range</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            {isSuper ? (
              <>
                <Input
                  placeholder="Search libraries…"
                  value={libSearch}
                  onChange={(e) => setLibSearch(e.target.value)}
                />
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
                <option value="">Select…</option>
                {branches?.items.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.branchName}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start #</Label>
                <Input type="number" {...form.register('startNumber', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>End #</Label>
                <Input type="number" {...form.register('endNumber', { valueAsNumber: true })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Prefix (optional)</Label>
              <Input {...form.register('prefix')} placeholder="A-" />
            </div>
            <div className="space-y-2">
              <Label>Pad length</Label>
              <Input type="number" {...form.register('padLength', { valueAsNumber: true })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Floor</Label>
                <Input {...form.register('floor')} />
              </div>
              <div className="space-y-2">
                <Label>Zone</Label>
                <Input {...form.register('zone')} />
              </div>
            </div>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Generate seats
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
