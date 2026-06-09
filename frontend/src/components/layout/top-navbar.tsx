'use client';

import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/common/theme-toggle';

import { MobileSidebar } from './mobile-sidebar';
import { SearchBar } from './search-bar';
import { NotificationMenu } from './notification-menu';
import { OwnerSubscriptionNavBadge } from './owner-subscription-nav-badge';
import { UserMenu } from './user-menu';
import { Breadcrumbs } from './breadcrumbs';

/**
 * Sticky top navbar: contains the mobile menu trigger, breadcrumbs (desktop),
 * global search, theme toggle, notifications, and the user menu.
 */
export function TopNavbar() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <MobileSidebar />

        <div className="hidden lg:block">
          <Breadcrumbs />
        </div>

        <div className="ml-auto flex flex-1 items-center justify-end gap-2">
          <SearchBar className="hidden md:block" />
          <Separator orientation="vertical" className="mx-1 hidden h-6 md:block" />
          <OwnerSubscriptionNavBadge />
          <ThemeToggle />
          <NotificationMenu />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
