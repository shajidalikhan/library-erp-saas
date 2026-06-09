'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { platformDemoRequestRoute } from '@/constants/routes';
import { platformApi } from '@/modules/platform/platform.service';
import { platformQueryKeys } from '@/modules/platform/platform-query-keys';

type DemoRequestRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  libraryName: string;
  city: string;
  branchCount: number;
  studentCount: number;
  status: string;
  createdAt: string;
};

const STATUS_OPTIONS = [
  'NEW',
  'CONTACTED',
  'DEMO_SCHEDULED',
  'CONVERTED',
  'REJECTED',
] as const;

const statusVariant = (status: string) => {
  if (status === 'REJECTED') return 'destructive' as const;
  if (status === 'CONVERTED') return 'default' as const;
  if (status === 'DEMO_SCHEDULED') return 'secondary' as const;
  return 'outline' as const;
};

export default function PlatformDemoRequestsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const params = useMemo(
    () => ({
      page: '1',
      limit: '30',
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(status ? { status } : {}),
    }),
    [search, status],
  );

  const q = useQuery({
    queryKey: platformQueryKeys.demoRequests(params),
    queryFn: () => platformApi.demoRequests(params),
  });

  const items = (q.data?.data.items ?? []) as DemoRequestRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demo Requests"
        description="Review inbound leads, qualify libraries, and track follow-up."
      />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search name, email, phone, library, city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={status === '' ? 'default' : 'outline'}
          onClick={() => setStatus('')}
        >
          All
        </Button>
        {STATUS_OPTIONS.map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={status === value ? 'default' : 'outline'}
            onClick={() => setStatus(value)}
          >
            {value.replace('_', ' ')}
          </Button>
        ))}
      </div>

      {q.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : q.isError ? (
        <p className="text-sm text-destructive">Could not load demo requests.</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No demo requests match your filters yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Library name</th>
                <th className="px-3 py-2">Contact person</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">City</th>
                <th className="px-3 py-2">Branches</th>
                <th className="px-3 py-2">Students</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created date</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 font-medium">{row.libraryName}</td>
                  <td className="px-3 py-2">{row.fullName}</td>
                  <td className="px-3 py-2">{row.phone}</td>
                  <td className="px-3 py-2">{row.email}</td>
                  <td className="px-3 py-2">{row.city}</td>
                  <td className="px-3 py-2">{row.branchCount}</td>
                  <td className="px-3 py-2">{row.studentCount}</td>
                  <td className="px-3 py-2">
                    <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={platformDemoRequestRoute(row.id)}>View details</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
