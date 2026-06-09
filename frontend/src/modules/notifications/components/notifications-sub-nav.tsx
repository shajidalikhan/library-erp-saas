'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/use-permissions';

const LINKS: { href: string; label: string; permissions: (typeof PERMISSIONS)[keyof typeof PERMISSIONS][] }[] = [
  { href: ROUTES.NOTIFICATIONS, label: 'Inbox', permissions: [PERMISSIONS.NOTIFICATION_READ] },
  { href: ROUTES.NOTIFICATIONS_SEND, label: 'Send', permissions: [PERMISSIONS.NOTIFICATION_SEND] },
  {
    href: ROUTES.NOTIFICATIONS_TEMPLATES,
    label: 'Templates',
    permissions: [PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE],
  },
  { href: ROUTES.NOTIFICATIONS_LOGS, label: 'Logs', permissions: [PERMISSIONS.NOTIFICATION_MANAGE] },
];

export function NotificationsSubNav() {
  const pathname = usePathname();
  const { canAny } = usePermissions();
  const visible = LINKS.filter((l) => canAny(l.permissions));
  if (visible.length <= 1) return null;

  return (
    <nav className="flex flex-wrap gap-2 border-b border-border pb-3">
      {visible.map((l) => {
        const isInbox =
          pathname === ROUTES.NOTIFICATIONS ||
          (pathname.startsWith(`${ROUTES.NOTIFICATIONS}/`) &&
            !pathname.startsWith(ROUTES.NOTIFICATIONS_SEND) &&
            !pathname.startsWith(ROUTES.NOTIFICATIONS_TEMPLATES) &&
            !pathname.startsWith(ROUTES.NOTIFICATIONS_LOGS));
        const active =
          l.href === ROUTES.NOTIFICATIONS ? isInbox : pathname === l.href || pathname.startsWith(`${l.href}/`);
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
