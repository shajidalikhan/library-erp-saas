'use client';

import Link from 'next/link';
import Image from 'next/image';
import { BookOpen } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ENV } from '@/lib/env';
import { ROUTES } from '@/constants/routes';
import { ROLES } from '@/constants/permissions';
import { selectUser, useAuthStore } from '@/store/auth.store';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function TenantBrand({ className, href = ROUTES.DASHBOARD }: { className?: string; href?: string }) {
  const user = useAuthStore(selectUser);
  const isSuper = user?.role === ROLES.SUPER_ADMIN;

  const title = isSuper ? ENV.APP_NAME : (user?.libraryName ?? ENV.APP_NAME);
  const subtitle = !isSuper && user?.branchName ? user.branchName : null;
  const logoUrl = !isSuper ? user?.libraryLogo : null;

  const mark = logoUrl ? (
    <Image
      src={logoUrl}
      alt=""
      width={32}
      height={32}
      className="h-8 w-8 rounded-lg object-cover"
      unoptimized
    />
  ) : (
    <span
      aria-hidden
      className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-xs font-semibold text-primary-foreground shadow-soft"
    >
      {isSuper ? <BookOpen className="h-4 w-4" strokeWidth={2.5} /> : initialsFromName(title)}
    </span>
  );

  return (
    <Link href={href} className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      {mark}
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold tracking-tight">{title}</span>
        {subtitle ? (
          <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
    </Link>
  );
}
