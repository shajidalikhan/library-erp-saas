'use client';

import { Card, CardContent } from '@/components/ui/card';
import { resolveDisplayAmenities } from './amenity-catalog';

type PublicAmenitiesProps = {
  amenities: string[];
};

export function PublicAmenities({ amenities }: PublicAmenitiesProps) {
  const items = resolveDisplayAmenities(amenities);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Amenities & facilities</h2>
      {items.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="border-slate-200/80 shadow-sm dark:border-slate-800">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium leading-snug">{item.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          Facilities will be updated soon.
        </p>
      )}
    </section>
  );
}
