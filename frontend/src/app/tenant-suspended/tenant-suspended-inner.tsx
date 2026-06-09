'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SupportContactActions } from '@/components/support/support-contact-actions';
import { usePlatformSupportConfig } from '@/hooks/use-platform-support-config';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';

export default function TenantSuspendedInner() {
  const { config } = usePlatformSupportConfig();
  const sp = useSearchParams();
  const reason = sp.get('reason') ?? '';
  const library = sp.get('library') ?? '';

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Access paused</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {library ? (
          <>
            The workspace <span className="font-medium text-foreground">{library}</span> has been suspended by
            platform administrators.
          </>
        ) : (
          <>Your library workspace has been suspended by platform administrators.</>
        )}
      </p>
      {reason ? (
        <div className="mt-6 rounded-lg border bg-muted/30 p-4 text-sm">
          <p className="text-xs font-medium uppercase text-muted-foreground">Reason</p>
          <p className="mt-1 whitespace-pre-wrap">{reason}</p>
        </div>
      ) : null}
      <p className="mt-6 text-sm text-muted-foreground">
        If you believe this is a mistake, contact your billing contact or platform support.
      </p>
      <div className="mt-8 space-y-4">
        <SupportContactActions config={config} />
        <Button asChild>
          <Link href={ROUTES.LOGIN}>Back to sign in</Link>
        </Button>
      </div>
    </div>
  );
}
