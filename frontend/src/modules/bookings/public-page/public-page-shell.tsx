'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type PublicPageShellProps = {
  children: ReactNode;
  className?: string;
  stickyCta?: ReactNode;
};

export function PublicPageShell({ children, className, stickyCta }: PublicPageShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-50">
      <div className={cn('mx-auto w-full max-w-6xl px-4 pb-24 pt-0 sm:px-6 lg:px-8', className)}>
        {children}
      </div>
      {stickyCta ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 p-3 shadow-lg backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">
          {stickyCta}
        </div>
      ) : null}
    </div>
  );
}

export function PublicPageLoading() {
  return (
    <PublicPageShell>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading library…</p>
      </div>
    </PublicPageShell>
  );
}

export function PublicPageError({ message = 'This library page is not available.' }: { message?: string }) {
  return (
    <PublicPageShell>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-semibold">Page not found</p>
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          Go to homepage
        </Link>
      </div>
    </PublicPageShell>
  );
}
