'use client';

import { BookOpen, CalendarCheck, Headphones, Sparkles } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { resolveDisplayAmenities } from './amenity-catalog';

const DEFAULT_TRUST = [
  { icon: Headphones, title: 'Quiet study environment', desc: 'Focused atmosphere for serious preparation.' },
  { icon: CalendarCheck, title: 'Flexible shifts', desc: 'Morning, evening, and full-day options.' },
  { icon: Sparkles, title: 'Seat availability online', desc: 'See what is open before you visit.' },
  { icon: BookOpen, title: 'Easy admission process', desc: 'Reserve online, complete admission at the desk.' },
];

type PublicTrustProps = {
  amenities: string[];
};

export function PublicTrust({ amenities }: PublicTrustProps) {
  const ownerItems = resolveDisplayAmenities(amenities).slice(0, 4);
  const useOwner = ownerItems.length >= 2;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Why choose this library?</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {useOwner
          ? ownerItems.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.label} className="border-slate-200/80 dark:border-slate-800">
                  <CardContent className="flex gap-3 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">Included at this library</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          : DEFAULT_TRUST.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="border-slate-200/80 dark:border-slate-800">
                  <CardContent className="flex gap-3 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>
    </section>
  );
}
