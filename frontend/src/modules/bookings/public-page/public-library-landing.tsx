'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { bookingsApi } from '@/modules/bookings/bookings.service';

import { PublicAmenities } from './public-amenities';
import { PublicAvailabilitySummary } from './public-availability-summary';
import { PublicGallery } from './public-gallery';
import { PublicHero } from './public-hero';
import { PublicLocation } from './public-location';
import { PublicPageError, PublicPageLoading, PublicPageShell } from './public-page-shell';
import { PublicShiftsPlans } from './public-shifts-plans';
import { PublicTrust } from './public-trust';
import { showFullSeatBreakdown } from './public-visibility';

export function PublicLibraryLanding() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-library', slug],
    queryFn: () => bookingsApi.getPublicLibrary(slug),
    enabled: Boolean(slug),
  });

  if (isLoading) return <PublicPageLoading />;
  if (isError || !data) return <PublicPageError />;

  const stickyCta =
    data.booking.enabled ? (
      <Button asChild className="w-full" size="lg">
        <Link href={`/l/${slug}/book`}>Book a seat</Link>
      </Button>
    ) : null;

  return (
    <PublicPageShell stickyCta={stickyCta ?? undefined}>
      <PublicHero slug={slug} data={data} />

      <div className="mt-8 space-y-12 pb-8">
        <PublicAvailabilitySummary
          summary={data.seatAvailabilitySummary}
          showFullBreakdown={showFullSeatBreakdown(data)}
        />
        <PublicShiftsPlans slug={slug} data={data} />
        <PublicAmenities amenities={data.library.amenities} />
        <PublicTrust amenities={data.library.amenities} />

        {data.library.rules.length ? (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">Library rules</h2>
            <Card className="border-slate-200/80 dark:border-slate-800">
              <CardContent className="space-y-2 p-5">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {data.library.rules.map((rule) => (
                    <li key={rule} className="flex gap-2">
                      <span className="text-primary">•</span>
                      {rule}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>
        ) : null}

        <PublicGallery photos={data.library.coverPhotos} libraryName={data.library.name} />
        <PublicLocation library={data.library} />
      </div>
    </PublicPageShell>
  );
}
