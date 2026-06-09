import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <span className="rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
        404
      </span>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        We can&apos;t find that page
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        The link you followed may be broken, or the page may have been moved.
      </p>
      <div className="mt-6 flex items-center gap-2">
        <Button asChild>
          <Link href={ROUTES.DASHBOARD}>Go to dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={ROUTES.ROOT}>Back home</Link>
        </Button>
      </div>
    </div>
  );
}
