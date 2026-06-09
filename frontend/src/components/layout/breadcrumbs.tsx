'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { useMemo } from 'react';

import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';

/**
 * Auto-derives breadcrumbs from the current URL.
 * Segments are humanized ("students" -> "Students").
 * The dashboard root is always the first crumb.
 */
export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();

  const crumbs = useMemo(() => {
    if (!pathname || !pathname.startsWith('/dashboard')) return [];
    const parts = pathname.replace(/^\/+|\/+$/g, '').split('/');
    return parts.map((part, idx) => {
      const href = '/' + parts.slice(0, idx + 1).join('/');
      const label =
        part === 'dashboard'
          ? 'Dashboard'
          : part.replace(/-/g, ' ').replace(/\b\w/g, (s) => s.toUpperCase());
      return { href, label, isLast: idx === parts.length - 1 };
    });
  }, [pathname]);

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center text-sm', className)}>
      <ol className="flex items-center gap-1.5 text-muted-foreground">
        <li>
          <Link
            href={ROUTES.DASHBOARD}
            className="flex items-center gap-1 hover:text-foreground"
          >
            <Home className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">Home</span>
          </Link>
        </li>
        {crumbs.map(({ href, label, isLast }) => (
          <li key={href} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />
            {isLast ? (
              <span className="font-medium text-foreground">{label}</span>
            ) : (
              <Link href={href} className="hover:text-foreground">
                {label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
