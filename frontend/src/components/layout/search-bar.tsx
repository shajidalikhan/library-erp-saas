'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';
import { selectUser, useAuthStore } from '@/store/auth.store';
import { ROLES } from '@/constants/permissions';
import { searchApi } from '@/modules/search/search.service';

function placeholderForRole(role: string | undefined): string {
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return 'Search libraries, users, tenants…';
    case ROLES.LIBRARY_OWNER:
      return 'Search students, seats, invoices…';
    case ROLES.MANAGER:
      return 'Search students, seats, attendance…';
    case ROLES.RECEPTIONIST:
      return 'Search students, seats, attendance…';
    case ROLES.ACCOUNTANT:
      return 'Search students, invoices, payments…';
    case ROLES.SECURITY:
      return 'Search students, active check-ins…';
    case ROLES.STUDENT:
      return 'Search your payments, attendance, notifications…';
    default:
      return 'Search…';
  }
}

export function SearchBar({ className }: { className?: string }) {
  const user = useAuthStore(selectUser);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(q, 300);
  const rootRef = useRef<HTMLDivElement>(null);

  const { data, isFetching, isError } = useQuery({
    queryKey: ['global-search', debounced],
    queryFn: () => searchApi.global(debounced.trim()),
    enabled: debounced.trim().length >= 2,
  });

  useEffect(() => {
    const onDoc = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        rootRef.current?.querySelector('input')?.focus();
      }
    };
    window.addEventListener('keydown', onDoc);
    return () => window.removeEventListener('keydown', onDoc);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const items = data?.items ?? [];
  const showDropdown = open && debounced.trim().length >= 2;

  return (
    <div ref={rootRef} className={cn('relative w-full max-w-md', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        placeholder={placeholderForRole(user?.role)}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="h-9 pl-9 pr-12 text-sm"
        aria-expanded={showDropdown}
        aria-controls="global-search-results"
        autoComplete="off"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 select-none items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:flex">
        <span className="text-[9px]">⌘</span>K
      </kbd>

      {showDropdown ? (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-80 overflow-auto rounded-md border bg-popover py-1 shadow-md"
        >
          {isFetching ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Searching…</p>
          ) : isError ? (
            <p className="px-3 py-6 text-center text-sm text-destructive">Search failed</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No results</p>
          ) : (
            items.map((item) => (
              <Link
                key={`${item.kind}-${item.id}`}
                href={item.hrefPath}
                role="option"
                className="flex flex-col px-3 py-2 text-sm hover:bg-accent"
                onClick={() => {
                  setOpen(false);
                  setQ('');
                }}
              >
                <span className="font-medium">{item.title}</span>
                {item.subtitle ? (
                  <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                ) : null}
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
