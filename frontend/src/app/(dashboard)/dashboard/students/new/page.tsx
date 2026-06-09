'use client';

import { useLayoutEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { ROUTES } from '@/constants/routes';

/** Legacy URL: `/students/new` → canonical `/students/create`. */
export default function LegacyStudentsNewRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useLayoutEffect(() => {
    const q = searchParams.toString();
    router.replace(`${ROUTES.STUDENTS}/create${q ? `?${q}` : ''}`);
  }, [router, searchParams]);

  return <p className="p-6 text-sm text-muted-foreground">Redirecting…</p>;
}
