'use client';

import { useEffect } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Global error boundary for unhandled errors inside any segment.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('App error boundary:', error);
    }
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertOctagon className="h-5 w-5" aria-hidden />
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        An unexpected error occurred. Please try again. If the problem
        continues, contact support.
      </p>
      <Button className="mt-5" onClick={() => reset()}>
        <RotateCcw className="h-4 w-4" /> Try again
      </Button>
    </div>
  );
}
