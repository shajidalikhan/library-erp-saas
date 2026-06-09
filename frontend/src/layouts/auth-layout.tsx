import { Quote } from 'lucide-react';

import { Logo } from '@/components/common/logo';
import { ROUTES } from '@/constants/routes';
import { ENV } from '@/lib/env';

/**
 * Two-pane auth layout:
 *  - Left  (md+): branded marketing pane with a quote / value prop.
 *  - Right    : the form card.
 *
 * Each auth page renders its own form inside the right pane.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand / marketing pane */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 -z-0 opacity-20 [mask-image:radial-gradient(closest-side,white,transparent)]">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.18),transparent_40%),radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.25),transparent_50%)]" />
        </div>

        <Logo href={ROUTES.ROOT} className="relative text-primary-foreground [&_span]:text-primary-foreground" />

        <div className="relative max-w-md">
          <Quote className="h-8 w-8 opacity-70" aria-hidden />
          <p className="mt-3 text-balance text-lg font-medium leading-snug">
            &ldquo;{ENV.APP_NAME} replaced three separate tools and gave our
            entire team a single, clear view of every branch &mdash; from seat
            occupancy to payments.&rdquo;
          </p>
          <p className="mt-3 text-sm text-primary-foreground/80">
            Director of Operations · Self&#8209;Study Library Network
          </p>
        </div>

        <p className="relative text-xs text-primary-foreground/70">
          &copy; {new Date().getFullYear()} {ENV.APP_NAME}. All rights reserved.
        </p>
      </aside>

      {/* Form pane */}
      <main className="relative flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="lg:hidden absolute left-6 top-6">
          <Logo href={ROUTES.ROOT} />
        </div>
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
