'use client';

import { Sparkles } from 'lucide-react';

import { SupportContactActions } from '@/components/support/support-contact-actions';
import { usePlatformSupportConfig } from '@/hooks/use-platform-support-config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import Link from 'next/link';
import { ROLES } from '@/constants/permissions';
import { selectUser, useAuthStore } from '@/store/auth.store';

export interface UpgradePlanCardProps {
  featureLabel: string;
  planName?: string;
  className?: string;
}

/** Shown when a library tries to use a feature not on their plan. */
export function UpgradePlanCard({ featureLabel, planName, className }: UpgradePlanCardProps) {
  const user = useAuthStore(selectUser);
  const isOwner = user?.role === ROLES.LIBRARY_OWNER;
  const { config } = usePlatformSupportConfig();

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden />
          <CardTitle className="text-lg">Upgrade required</CardTitle>
        </div>
        <CardDescription>
          {featureLabel} is not included on your {planName ? `${planName} ` : ''}subscription.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <p>Contact support to upgrade your plan and unlock this capability. Existing data is safe.</p>
        <div className="flex flex-wrap gap-2">
          {isOwner ? (
            <Button asChild variant="default" size="sm">
              <Link href={ROUTES.BILLING}>View billing</Link>
            </Button>
          ) : null}
          <SupportContactActions config={config} compact />
        </div>
      </CardContent>
    </Card>
  );
}
