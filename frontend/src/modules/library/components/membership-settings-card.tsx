'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api-error';
import { parseLibraryMembershipSettings } from '@/modules/membership/partial-plan-utils';
import { libraryApi } from '@/modules/library/library.service';
import type { Library } from '@/modules/library/types';

export function MembershipSettingsCard({ library }: { library: Library }) {
  const existing = parseLibraryMembershipSettings(
    (library.settings as Record<string, unknown>) ?? {},
  );
  const [partialDueDays, setPartialDueDays] = useState(String(existing.partialDueDays ?? 7));
  const [allowLongPlanPartialStart, setAllowLongPlanPartialStart] = useState(
    existing.allowLongPlanPartialStart ?? false,
  );
  const [defaultDowngradeDurationDays, setDefaultDowngradeDurationDays] = useState(
    String(existing.defaultDowngradeDurationDays ?? 30),
  );
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const s = parseLibraryMembershipSettings((library.settings as Record<string, unknown>) ?? {});
    setPartialDueDays(String(s.partialDueDays ?? 7));
    setAllowLongPlanPartialStart(s.allowLongPlanPartialStart ?? false);
    setDefaultDowngradeDurationDays(String(s.defaultDowngradeDurationDays ?? 30));
  }, [library]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Membership partial payment defaults</CardTitle>
        <CardDescription>
          Library-wide defaults for long-duration plans. Individual fee plans can override these.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allowLongPlanPartialStart}
            onChange={(e) => setAllowLongPlanPartialStart(e.target.checked)}
          />
          Allow long-plan partial start by default
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Default due period (days)</Label>
            <Input
              type="number"
              min={1}
              value={partialDueDays}
              onChange={(e) => setPartialDueDays(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Default downgrade duration (days)</Label>
            <Input
              type="number"
              min={1}
              value={defaultDowngradeDurationDays}
              onChange={(e) => setDefaultDowngradeDurationDays(e.target.value)}
            />
          </div>
        </div>
        <Button
          loading={pending}
          onClick={async () => {
            try {
              setPending(true);
              const current = (library.settings as Record<string, unknown>) ?? {};
              await libraryApi.patchLibrarySettings(library._id, {
                ...current,
                membership: {
                  partialDueDays: Math.max(1, Number(partialDueDays) || 7),
                  allowLongPlanPartialStart,
                  defaultDowngradeDurationDays: Math.max(
                    1,
                    Number(defaultDowngradeDurationDays) || 30,
                  ),
                },
              });
              toast.success('Membership settings saved');
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : 'Failed to save settings');
            } finally {
              setPending(false);
            }
          }}
        >
          Save membership defaults
        </Button>
      </CardContent>
    </Card>
  );
}
