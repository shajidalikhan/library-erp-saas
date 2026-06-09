'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTenantScope } from '@/hooks/use-tenant-scope';
import { bookingsApi } from '@/modules/bookings/bookings.service';
import { parsePublicBookingApiError } from '@/modules/bookings/lib/public-booking-access';

function populatedLabel(value: unknown, key: string): string {
  if (!value || typeof value !== 'object') return '';
  const row = value as Record<string, unknown>;
  return typeof row[key] === 'string' ? row[key] : '';
}

type BookingRow = Record<string, unknown>;

type BookingDetailResponse = {
  booking?: BookingRow;
};

export function PublicBookingListTab() {
  const { effectiveLibraryId, isSuperAdmin } = useTenantScope();
  const [search, setSearch] = useState('');
  const [bookingStatus, setBookingStatus] = useState('');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['public-booking-list', effectiveLibraryId, search, bookingStatus],
    queryFn: () =>
      bookingsApi.listOwnerBookings({
        libraryId: effectiveLibraryId || undefined,
        search: search || undefined,
        bookingStatus: bookingStatus || undefined,
        limit: 100,
      }),
    enabled: !isSuperAdmin || Boolean(effectiveLibraryId),
  });

  const { data: bookingDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['public-booking-detail', selectedBookingId, effectiveLibraryId],
    queryFn: () => bookingsApi.getOwnerBooking(selectedBookingId!),
    enabled: Boolean(selectedBookingId && sheetOpen),
  });

  const booking = (bookingDetail as BookingDetailResponse | undefined)?.booking;

  const onMutationError = (err: unknown) => {
    toast.error(parsePublicBookingApiError(err) ?? 'Action failed. Please try again.');
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => bookingsApi.approveBooking(id),
    onSuccess: () => {
      toast.success('Booking approved');
      void qc.invalidateQueries({ queryKey: ['public-booking-list'] });
      void qc.invalidateQueries({ queryKey: ['public-booking-detail'] });
    },
    onError: onMutationError,
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => bookingsApi.rejectBooking(id),
    onSuccess: () => {
      toast.success('Booking rejected');
      void qc.invalidateQueries({ queryKey: ['public-booking-list'] });
      void qc.invalidateQueries({ queryKey: ['public-booking-detail'] });
    },
    onError: onMutationError,
  });
  const convertMutation = useMutation({
    mutationFn: (id: string) => bookingsApi.convertToStudent(id),
    onSuccess: () => {
      toast.success('Converted to student');
      void qc.invalidateQueries({ queryKey: ['public-booking-list'] });
      void qc.invalidateQueries({ queryKey: ['public-booking-detail'] });
    },
    onError: onMutationError,
  });

  const openRow = (id: string) => {
    setSelectedBookingId(id);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-4">
      {isSuperAdmin && !effectiveLibraryId ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Select a library workspace first to view public bookings.
        </div>
      ) : null}

      <Input
        className="max-w-sm"
        placeholder="Search name, phone, email, reference"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <select
        className="h-9 rounded-md border bg-background px-2 text-sm"
        value={bookingStatus}
        onChange={(e) => setBookingStatus(e.target.value)}
      >
        <option value="">All statuses</option>
        <option value="HOLD">Hold</option>
        <option value="APPROVED">Approved</option>
        <option value="REJECTED">Rejected</option>
        <option value="CONVERTED">Converted</option>
        <option value="EXPIRED">Expired</option>
      </select>

      {isError ? (
        <p className="text-sm text-destructive">
          {parsePublicBookingApiError(error) ?? 'Could not load bookings. Please try again.'}
        </p>
      ) : null}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Shift</TableHead>
              <TableHead>Seat</TableHead>
              <TableHead>Hold expiry</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9}>Loading bookings...</TableCell>
              </TableRow>
            ) : (data?.items.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={9}>No public bookings found yet.</TableCell>
              </TableRow>
            ) : (
              data?.items.map((row) => {
                const id = String(row._id);
                const seatLabel =
                  populatedLabel(row.seatId, 'seatNumber') || String(row.selectedSeatNumber ?? '—');
                const shiftLabel = populatedLabel(row.shiftId, 'name') || String(row.selectedShiftName ?? '—');
                const branchLabel = populatedLabel(row.branchId, 'branchName') || '—';
                const expiresAt = row.expiresAt ? new Date(String(row.expiresAt)) : null;
                const expired = expiresAt ? expiresAt.getTime() < Date.now() : false;

                return (
                  <TableRow key={id} className="cursor-pointer hover:bg-muted/40" onClick={() => openRow(id)}>
                    <TableCell>{String(row.fullName ?? '—')}</TableCell>
                    <TableCell>{String(row.phone ?? '—')}</TableCell>
                    <TableCell>{String(row.bookingReference ?? '—')}</TableCell>
                    <TableCell>{branchLabel}</TableCell>
                    <TableCell>{shiftLabel}</TableCell>
                    <TableCell>{seatLabel}</TableCell>
                    <TableCell>
                      {expiresAt ? (
                        <span className={expired ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                          {expiresAt.toLocaleString()}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{String(row.bookingStatus ?? '—')}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRow(id);
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Booking details</SheetTitle>
            <SheetDescription>Review visitor submission and take action.</SheetDescription>
          </SheetHeader>
          {detailLoading || !booking ? (
            <p className="mt-6 text-sm text-muted-foreground">Loading details...</p>
          ) : (
            <div className="mt-6 space-y-3 text-sm">
              <p>
                <strong>Name:</strong> {String(booking.fullName ?? '—')}
              </p>
              <p>
                <strong>Phone:</strong> {String(booking.phone ?? '—')}
              </p>
              <p>
                <strong>Email:</strong> {String(booking.email ?? '—')}
              </p>
              <p>
                <strong>Reference:</strong> {String(booking.bookingReference ?? '—')}
              </p>
              <p>
                <strong>Branch:</strong>{' '}
                {populatedLabel(booking.branchId, 'branchName') || '—'}
              </p>
              <p>
                <strong>Shift:</strong>{' '}
                {populatedLabel(booking.shiftId, 'name') || String(booking.selectedShiftName ?? '—')}
              </p>
              <p>
                <strong>Seat:</strong>{' '}
                {populatedLabel(booking.seatId, 'seatNumber') || String(booking.selectedSeatNumber ?? '—')}
              </p>
              <p>
                <strong>Status:</strong> {String(booking.bookingStatus ?? '—')}
              </p>
              <p>
                <strong>Expires:</strong>{' '}
                {booking.expiresAt ? new Date(String(booking.expiresAt)).toLocaleString() : 'No expiry'}
              </p>
              {booking.address ? (
                <p>
                  <strong>Address:</strong> {String(booking.address)}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={booking.bookingStatus !== 'HOLD' && booking.bookingStatus !== 'APPROVED'}
                  onClick={() => selectedBookingId && approveMutation.mutate(selectedBookingId)}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={booking.bookingStatus === 'CONVERTED' || booking.bookingStatus === 'REJECTED'}
                  onClick={() => selectedBookingId && rejectMutation.mutate(selectedBookingId)}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  disabled={booking.bookingStatus === 'CONVERTED' || booking.bookingStatus === 'EXPIRED'}
                  onClick={() => selectedBookingId && convertMutation.mutate(selectedBookingId)}
                >
                  Convert
                </Button>
              </div>

              {selectedBookingId ? (
                <Button asChild size="sm" className="w-full">
                  <Link
                    href={`/dashboard/students/create?prefillBookingId=${encodeURIComponent(selectedBookingId)}`}
                  >
                    Open admission prefill
                  </Link>
                </Button>
              ) : null}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
