'use client';

import { Armchair } from 'lucide-react';

import { cn } from '@/lib/utils';

import { filterPublicSummaryForDisplay } from './public-visibility';

type PublicAvailabilitySummaryProps = {
  summary: Record<string, number>;
  showFullBreakdown?: boolean;
};

const CARD_STYLES: Record<string, string> = {
  AVAILABLE:
    'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100',
  OCCUPIED:
    'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-100',
  RESERVED_BLOCKED:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100',
};

export function PublicAvailabilitySummary({
  summary,
  showFullBreakdown = false,
}: PublicAvailabilitySummaryProps) {
  const cards = filterPublicSummaryForDisplay(summary, showFullBreakdown);

  return (
    <section id="seats" className="scroll-mt-24 space-y-4">
      <div className="flex items-center gap-2">
        <Armchair className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold tracking-tight">Seat availability</h2>
      </div>
      <div
        className={cn(
          'grid gap-3',
          cards.length === 1 ? 'max-w-md' : 'sm:grid-cols-3',
        )}
      >
        {cards.map((card) => (
          <div
            key={card.key}
            className={cn(
              'rounded-2xl border p-5 shadow-sm transition hover:shadow-md',
              CARD_STYLES[card.key] ?? CARD_STYLES.AVAILABLE,
            )}
          >
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">{card.label}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{card.count}</p>
            {!showFullBreakdown ? null : (
              <p className="mt-1 text-xs opacity-70">seats</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
