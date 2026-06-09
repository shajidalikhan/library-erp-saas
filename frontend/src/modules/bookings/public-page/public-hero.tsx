'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Phone, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PublicLibraryProfile } from '@/modules/bookings/types';

import {
  formatAddress,
  getCoverPhoto,
  resolveLibraryLogoUrl,
  resolveMapsOpenUrl,
  whatsAppUrl,
} from './utils';

type PublicHeroProps = {
  slug: string;
  data: PublicLibraryProfile;
};

export function PublicHero({ slug, data }: PublicHeroProps) {
  const { library } = data;
  const cover = getCoverPhoto(library.coverPhotos);
  const logoUrl = resolveLibraryLogoUrl(library.logo);
  const address = formatAddress(library);
  const available = data.seatAvailabilitySummary.AVAILABLE ?? 0;
  const mapsUrl = resolveMapsOpenUrl(library.mapLocation, library.latitude, library.longitude);
  const bookingEnabled = data.booking.enabled;

  return (
    <section className="relative -mx-4 overflow-hidden sm:-mx-6 lg:-mx-8">
      <div className="relative min-h-[320px] sm:min-h-[380px]">
        {cover?.url ? (
          <>
            <Image
              src={cover.url}
              alt={cover.caption || `${library.name} cover`}
              fill
              priority
              className="object-cover"
              sizes="100vw"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-slate-900/30" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-700 via-violet-800 to-slate-900" />
        )}

        <div className="relative z-10 flex min-h-[320px] flex-col justify-end px-4 pb-8 pt-16 sm:min-h-[380px] sm:px-8 sm:pb-10">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="flex gap-4">
              {logoUrl ? (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-white/30 bg-white shadow-xl sm:h-20 sm:w-20">
                  <Image src={logoUrl} alt="" fill className="object-cover" unoptimized />
                </div>
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-2xl font-bold text-white backdrop-blur sm:h-20 sm:w-20">
                  {library.name.charAt(0)}
                </div>
              )}
              <div className="space-y-2 text-white">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-white/20 bg-white/15 text-white hover:bg-white/20">
                    <Sparkles className="mr-1 h-3 w-3" />
                    Study library
                  </Badge>
                  {bookingEnabled ? (
                    <Badge className="border-emerald-400/40 bg-emerald-500/20 text-emerald-50">
                      {available} seats available
                    </Badge>
                  ) : null}
                </div>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">{library.name}</h1>
                <p className="max-w-2xl text-sm text-white/85 sm:text-base">
                  {library.description || 'Quiet, focused study space with flexible shifts and online seat booking.'}
                </p>
                {address ? (
                  <p className="flex items-start gap-2 text-sm text-white/75">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    {address}
                  </p>
                ) : null}
                {library.phone ? (
                  <p className="flex items-center gap-2 text-sm text-white/75">
                    <Phone className="h-4 w-4 shrink-0" />
                    {library.phone}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="hidden flex-wrap gap-2 md:flex">
              {bookingEnabled ? (
                <Button asChild size="lg" className="shadow-lg">
                  <Link href={`/l/${slug}/book`}>Book a seat</Link>
                </Button>
              ) : null}
              <Button asChild size="lg" variant="secondary" className="bg-white/95 text-slate-900 hover:bg-white">
                <a href="#seats">View seats</a>
              </Button>
              {mapsUrl ? (
                <Button asChild size="lg" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                  <a href={mapsUrl} target="_blank" rel="noreferrer">
                    Get directions
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="hidden border-b bg-white px-4 py-3 dark:bg-slate-900 sm:px-8 md:block">
        <div className="flex flex-wrap gap-2">
          {bookingEnabled ? (
            <Button asChild>
              <Link href={`/l/${slug}/book`}>Book a seat</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <a href="#seats">View availability</a>
          </Button>
          {mapsUrl ? (
            <Button asChild variant="outline">
              <a href={mapsUrl} target="_blank" rel="noreferrer">
                Get directions
              </a>
            </Button>
          ) : null}
          {library.whatsapp ? (
            <Button asChild variant="outline">
              <a
                href={whatsAppUrl(library.whatsapp, `Hi, I found ${library.name} online and have a question.`)}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
