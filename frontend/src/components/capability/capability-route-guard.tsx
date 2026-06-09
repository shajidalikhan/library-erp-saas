'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { EmptyState } from '@/components/common/empty-state';
import { ROUTES } from '@/constants/routes';
import { resolveRouteCapability } from '@/constants/capability-routes';
import { useCapability } from '@/hooks/use-capability';

export function CapabilityRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { canUseModule } = useCapability();
  const rule = resolveRouteCapability(pathname);

  const result = rule
    ? canUseModule(rule.module, rule.action ?? 'view', rule.permission)
    : { allowed: true, reason: '', source: 'ok' as const, upgradeRequired: false };

  useEffect(() => {
    if (rule && !result.allowed && result.source === 'role_capability') {
      router.replace(ROUTES.DASHBOARD);
    }
  }, [rule, result.allowed, result.source, router]);

  if (!rule || result.allowed) return <>{children}</>;

  return (
    <EmptyState
      title="Access restricted"
      description={result.reason || 'You do not have access to this feature.'}
    />
  );
}
