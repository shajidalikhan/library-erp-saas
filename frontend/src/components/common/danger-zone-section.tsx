import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function DangerZoneSection({
  title = 'Danger zone',
  description,
  children,
  className,
}: {
  title?: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-lg border-2 border-destructive/40 bg-destructive/5 p-6 space-y-4',
        className,
      )}
    >
      <div>
        <h2 className="text-lg font-semibold text-destructive">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}
