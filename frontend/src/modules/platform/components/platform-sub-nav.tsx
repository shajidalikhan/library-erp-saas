'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';

const LINKS: { href: string; label: string }[] = [
  { href: ROUTES.PLATFORM, label: 'Dashboard' },
  { href: ROUTES.PLATFORM_TENANTS, label: 'Tenants' },
  { href: ROUTES.PLATFORM_PLANS, label: 'Plans' },
  { href: ROUTES.PLATFORM_USAGE, label: 'Usage' },
  { href: ROUTES.PLATFORM_AUDIT, label: 'Audit logs' },
  { href: ROUTES.PLATFORM_DEMO_REQUESTS, label: 'Demo requests' },
  { href: ROUTES.PLATFORM_ROLE_CAPABILITIES, label: 'Role capabilities' },
  { href: ROUTES.PLATFORM_SETTINGS, label: 'Settings' },
  { href: ROUTES.PLATFORM_ANNOUNCEMENTS, label: 'Announcements' },
];

export function PlatformSubNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2 border-b border-border pb-3">
      {LINKS.map((l) => {
        const active =
          pathname === l.href ||
          (l.href === ROUTES.PLATFORM ? false : pathname.startsWith(l.href));
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
