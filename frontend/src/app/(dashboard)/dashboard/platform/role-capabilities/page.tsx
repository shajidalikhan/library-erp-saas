'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { STAFF_ROLE_PERMISSIONS } from '@/constants/staff-role-permissions';
import { MODULE_ACTIONS } from '@/lib/capability-constants';
import {
  deriveModuleFlagsFromCapabilities,
  filterVisibleNavSections,
} from '@/lib/can-show-navigation';
import { platformApi } from '@/modules/platform/platform.service';
import { authService } from '@/modules/auth/auth.service';
import type { RoleCapabilityModule, RoleCapabilities } from '@/types/auth';
import { selectUser, useAuthStore } from '@/store/auth.store';

const MODULE_LABELS: Record<RoleCapabilityModule, string> = {
  students: 'Students',
  attendance: 'Attendance',
  seats: 'Seats',
  shifts: 'Shifts',
  payments: 'Payments',
  invoices: 'Invoices',
  dues: 'Dues',
  reports: 'Reports',
  analytics: 'Analytics',
  notifications: 'Notifications',
  settings: 'Settings',
  public_booking: 'Public Booking',
};

type RoleCapabilitiesConfig = Awaited<ReturnType<typeof platformApi.getRoleCapabilities>>;

export default function PlatformRoleCapabilitiesPage() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const currentUser = useAuthStore(selectUser);
  const [role, setRole] = useState<string>('MANAGER');
  const [expanded, setExpanded] = useState<RoleCapabilityModule | null>('students');

  const configQ = useQuery({
    queryKey: ['platform', 'role-capabilities'],
    queryFn: () => platformApi.getRoleCapabilities(),
  });

  const patchM = useMutation({
    mutationFn: (patch: {
      modules?: Record<string, boolean>;
      actions?: Record<string, Record<string, boolean>>;
    }) => platformApi.patchRoleCapabilities(role, patch),
    onSuccess: (data) => {
      toast.success('Changes saved. Users may need to refresh or sign in again.');
      if (data?.matrix) {
        qc.setQueryData<RoleCapabilitiesConfig | undefined>(
          ['platform', 'role-capabilities'],
          (prev) =>
            prev
              ? {
                  ...prev,
                  matrix: data.matrix,
                  moduleFlags: data.moduleFlags ?? prev.moduleFlags,
                }
              : prev,
        );
      }
      void qc.invalidateQueries({ queryKey: ['platform', 'role-capabilities'] });
      if (currentUser?.role === role) {
        void authService.me().then(setUser).catch(() => undefined);
      }
    },
    onError: () => toast.error('Could not save capabilities'),
  });

  const matrix = configQ.data?.matrix as Record<string, RoleCapabilities> | undefined;
  const roleRow = matrix?.[role];

  const moduleEnabled = (mod: RoleCapabilityModule): boolean =>
    roleRow?.[mod] ? Object.values(roleRow[mod]).some(Boolean) : false;

  const setModule = (mod: RoleCapabilityModule, enabled: boolean) => {
    const actions: Record<string, boolean> = {};
    for (const action of MODULE_ACTIONS[mod]) {
      actions[action] = enabled;
    }
    patchM.mutate({ modules: { [mod]: enabled }, actions: { [mod]: actions } });
  };

  const setAction = (mod: RoleCapabilityModule, action: string, enabled: boolean) => {
    const current = roleRow?.[mod] ?? {};
    const actions: Record<string, boolean> = {};
    for (const key of MODULE_ACTIONS[mod]) {
      actions[key] = key === action ? enabled : Boolean(current[key]);
    }
    patchM.mutate({ actions: { [mod]: actions } });
  };

  const previewSections = useMemo(() => {
    if (!roleRow) return [];
    const permissions = STAFF_ROLE_PERMISSIONS[role as keyof typeof STAFF_ROLE_PERMISSIONS] ?? [];
    return filterVisibleNavSections({
      role,
      permissions,
      libraryId: 'preview-library',
      roleCapabilities: roleRow,
      roleModules: deriveModuleFlagsFromCapabilities(roleRow),
      assumeAllSubscriptionFeatures: true,
    });
  }, [role, roleRow]);

  if (configQ.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Role capabilities"
        description="Module and action-level access. Changes apply to sidebar, routes, buttons, and APIs."
      />

      <div className="grid gap-1">
        <Label>Role</Label>
        <select
          className="h-9 max-w-xs rounded-md border border-input bg-background px-2 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {(configQ.data?.roles ?? []).map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          {(Object.keys(MODULE_LABELS) as RoleCapabilityModule[]).map((mod) => (
            <Card key={mod}>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <div>
                  <CardTitle className="text-base">{MODULE_LABELS[mod]}</CardTitle>
                  <CardDescription className="text-xs">
                    {moduleEnabled(mod) ? 'Module enabled' : 'Module disabled'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={moduleEnabled(mod)}
                      disabled={patchM.isPending}
                      onChange={(e) => setModule(mod, e.target.checked)}
                    />
                    All
                  </label>
                  <button
                    type="button"
                    className="text-xs text-primary underline"
                    onClick={() => setExpanded(expanded === mod ? null : mod)}
                  >
                    {expanded === mod ? 'Hide actions' : 'Actions'}
                  </button>
                </div>
              </CardHeader>
              {expanded === mod ? (
                <CardContent className="grid gap-2 border-t pt-3 sm:grid-cols-2">
                  {MODULE_ACTIONS[mod].map((action) => (
                    <label key={action} className="flex items-center gap-2 text-sm capitalize">
                      <input
                        type="checkbox"
                        checked={Boolean(roleRow?.[mod]?.[action])}
                        disabled={patchM.isPending}
                        onChange={(e) => setAction(mod, action, e.target.checked)}
                      />
                      {action.replace(/_/g, ' ')}
                    </label>
                  ))}
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sidebar preview</CardTitle>
            <CardDescription>
              Same rules as the live sidebar (RBAC + capabilities). Plan features assumed on.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {previewSections.length === 0 ? (
              <p className="text-sm text-muted-foreground">No navigation items visible</p>
            ) : (
              <div className="space-y-3">
                {previewSections.map((section) => (
                  <div key={section.label ?? 'main'}>
                    {section.label ? (
                      <p className="text-xs font-medium uppercase text-muted-foreground">{section.label}</p>
                    ) : null}
                    <ul className="mt-1 space-y-1 text-sm">
                      {section.items.map((item) => (
                        <li key={item.href}>{item.label}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
