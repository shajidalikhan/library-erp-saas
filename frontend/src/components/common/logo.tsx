import { BookOpen } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { ENV } from '@/lib/env';
import { ROUTES } from '@/constants/routes';

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  href?: string;
}

/**
 * Brand logo used in the auth screens and sidebar. The mark is intentionally
 * built from a Lucide icon + a gradient surface so the platform can be
 * re-skinned by editing CSS variables only - no SVG asset is required.
 */
export function Logo({ className, showWordmark = true, href = ROUTES.DASHBOARD }: LogoProps) {
  const content = (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        aria-hidden
        className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-soft"
      >
        <BookOpen className="h-4 w-4" strokeWidth={2.5} />
      </span>
      {showWordmark ? (
        <span className="text-sm font-semibold tracking-tight">{ENV.APP_NAME}</span>
      ) : null}
    </span>
  );

  if (!href) return content;
  return <Link href={href}>{content}</Link>;
}
