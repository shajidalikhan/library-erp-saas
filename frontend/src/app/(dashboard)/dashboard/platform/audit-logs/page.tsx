'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/page-header';
import { LibrarySelect } from '@/components/selectors/library-select';
import { BranchSelect } from '@/components/selectors/branch-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatEntityLabel } from '@/lib/entity-label';
import { Skeleton } from '@/components/ui/skeleton';
import { platformApi } from '@/modules/platform/platform.service';
import { platformQueryKeys } from '@/modules/platform/platform-query-keys';

const PAGE_SIZES = ['20', '40', '100'] as const;

export default function PlatformAuditPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState('40');
  const [libraryId, setLibraryId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [module, setModule] = useState('');
  const [severity, setSeverity] = useState('');
  const [actorUserId, setActorUserId] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showAll, setShowAll] = useState(false);

  const params = useMemo(
    () => ({
      page: String(page),
      limit,
      ...(libraryId ? { libraryId } : {}),
      ...(branchId ? { branchId } : {}),
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(module ? { module } : {}),
      ...(severity ? { severity } : {}),
      ...(actorUserId ? { actorUserId } : {}),
      ...(q ? { q } : {}),
      ...(from ? { from: new Date(from).toISOString() } : {}),
      ...(to ? { to: new Date(to).toISOString() } : {}),
      ...(showAll ? { showAll: 'true' } : {}),
    }),
    [page, limit, libraryId, branchId, action, entityType, module, severity, actorUserId, q, from, to, showAll],
  );

  const auditQ = useQuery({
    queryKey: platformQueryKeys.audit(params),
    queryFn: () => platformApi.auditLogs(params),
  });

  const items = (auditQ.data?.data.items ?? []) as Record<string, unknown>[];
  const pagination = auditQ.data?.meta?.pagination as
    | { totalPages?: number; hasNext?: boolean; hasPrev?: boolean }
    | undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="Audit logs" description="Immutable platform and security-relevant actions." />

      <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4">
        <LibrarySelect label="Library" value={libraryId} onChange={(id) => { setLibraryId(id); setBranchId(''); setPage(1); }} />
        <BranchSelect
          label="Branch"
          libraryId={libraryId || null}
          value={branchId}
          onChange={(id) => { setBranchId(id); setPage(1); }}
          disabled={!libraryId}
        />
        <div className="space-y-1.5">
          <Label>Action</Label>
          <Input value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} placeholder="e.g. SUBSCRIPTION_ADJUST" />
        </div>
        <div className="space-y-1.5">
          <Label>Entity type</Label>
          <Input value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} placeholder="e.g. LIBRARY" />
        </div>
        <div className="space-y-1.5">
          <Label>Module</Label>
          <Input value={module} onChange={(e) => { setModule(e.target.value); setPage(1); }} placeholder="metadata.module" />
        </div>
        <div className="space-y-1.5">
          <Label>Severity</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={severity}
            onChange={(e) => { setSeverity(e.target.value); setPage(1); }}
          >
            <option value="">Any</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Actor user ID</Label>
          <Input value={actorUserId} onChange={(e) => { setActorUserId(e.target.value); setPage(1); }} placeholder="24-char id" />
        </div>
        <div className="space-y-1.5">
          <Label>Search</Label>
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Action or entity" />
        </div>
        <div className="space-y-1.5">
          <Label>From</Label>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        </div>
        <div className="space-y-1.5">
          <Label>To</Label>
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
        <div className="space-y-1.5">
          <Label>Page size</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={limit}
            onChange={(e) => { setLimit(e.target.value); setPage(1); }}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => { setShowAll(e.target.checked); setPage(1); }}
          />
          Show all logs (no 90-day window)
        </label>
      </div>

      {auditQ.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : auditQ.isError ? (
        <p className="text-sm text-destructive">Could not load audit logs.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Entity</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Library</th>
                  <th className="px-3 py-2">Branch</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((a) => (
                  <tr key={String(a.id)}>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                      {new Date(String(a.createdAt)).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">{String(a.action)}</td>
                    <td className="px-3 py-2">
                      {String(a.entityType)}
                      {a.entityLabel ? ` · ${String(a.entityLabel)}` : ''}
                    </td>
                    <td className="px-3 py-2 text-xs">{formatEntityLabel(a, 'audit')}</td>
                    <td className="px-3 py-2 text-xs">{formatEntityLabel(a, 'library')}</td>
                    <td className="px-3 py-2 text-xs">{formatEntityLabel(a, 'branch')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm" disabled={!pagination?.hasPrev} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page}</span>
            <Button type="button" variant="outline" size="sm" disabled={!pagination?.hasNext} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
