'use client';

import Link from 'next/link';
import { ExternalLink, MapPin } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { PublicLibraryProfile } from '@/modules/bookings/types';

import { formatAddress, resolveMapsEmbedUrl, resolveMapsOpenUrl } from './utils';

type PublicLocationProps = {
  library: PublicLibraryProfile['library'];
};

export function PublicLocation({ library }: PublicLocationProps) {
  const address = formatAddress(library);
  const openUrl = resolveMapsOpenUrl(library.mapLocation, library.latitude, library.longitude);
  const embedUrl = resolveMapsEmbedUrl(library.mapLocation, library.latitude, library.longitude);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Location</h2>
      <Card className="overflow-hidden border-slate-200/80 shadow-sm dark:border-slate-800">
        {embedUrl ? (
          <div className="aspect-[16/10] w-full bg-muted sm:aspect-[21/9]">
            <iframe
              title={`Map — ${library.name}`}
              src={embedUrl}
              className="h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        ) : null}
        <CardContent className="space-y-3 p-5">
          {address ? (
            <p className="flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {address}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Address will be updated soon.</p>
          )}
          {openUrl ? (
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <a href={openUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in Google Maps
              </a>
            </Button>
          ) : null}
          {!embedUrl && !openUrl ? (
            <p className="text-sm text-muted-foreground">Map will be available once the library adds a location.</p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
