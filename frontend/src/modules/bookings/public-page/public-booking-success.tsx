'use client';

import Link from 'next/link';
import { CheckCircle2, Copy, ExternalLink, MessageCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { PublicLibraryProfile } from '@/modules/bookings/types';

import { resolveMapsOpenUrl, whatsAppUrl } from './utils';

export type PublicBookingHoldResult = {
  bookingReference?: string;
  seatNumber?: string;
  shiftName?: string;
  expiresAt?: string;
  contactPhone?: string;
};

type PublicBookingSuccessProps = {
  slug: string;
  library: PublicLibraryProfile['library'];
  hold: PublicBookingHoldResult;
  message?: string;
};

export function PublicBookingSuccess({ slug, library, hold, message }: PublicBookingSuccessProps) {
  const mapsUrl = resolveMapsOpenUrl(library.mapLocation, library.latitude, library.longitude);
  const ref = hold.bookingReference ?? '—';

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(ref);
      toast.success('Reference copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-lg dark:border-emerald-900 dark:from-emerald-950/40 dark:to-slate-900">
      <CardContent className="space-y-5 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Seat reserved</h2>
            <p className="text-sm text-muted-foreground">Hold confirmed for 3 hours</p>
          </div>
        </div>

        <p className="text-sm leading-relaxed">
          {message ||
            'Your selected seat is held for 3 hours. Please visit the library to complete admission and payment.'}
        </p>

        <dl className="grid gap-3 rounded-xl bg-background/80 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Reference</dt>
            <dd className="font-mono font-semibold">{ref}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Seat</dt>
            <dd className="font-semibold">{hold.seatNumber ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Shift</dt>
            <dd className="font-semibold">{hold.shiftName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Hold expires</dt>
            <dd className="font-semibold">
              {hold.expiresAt ? new Date(hold.expiresAt).toLocaleString() : '—'}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void copyRef()}>
            <Copy className="mr-2 h-4 w-4" />
            Copy reference
          </Button>
          {mapsUrl ? (
            <Button asChild variant="outline">
              <a href={mapsUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Get directions
              </a>
            </Button>
          ) : null}
          {(hold.contactPhone || library.phone) ? (
            <Button asChild variant="outline">
              <a href={`tel:${hold.contactPhone || library.phone}`}>
                <Phone className="mr-2 h-4 w-4" />
                Call library
              </a>
            </Button>
          ) : null}
          {library.whatsapp ? (
            <Button asChild variant="outline">
              <a
                href={whatsAppUrl(
                  library.whatsapp,
                  `Hi, I reserved seat ${hold.seatNumber ?? ''} (ref ${ref}) at ${library.name}.`,
                )}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </a>
            </Button>
          ) : null}
          <Button asChild variant="secondary">
            <Link href={`/l/${slug}`}>Back to library page</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
