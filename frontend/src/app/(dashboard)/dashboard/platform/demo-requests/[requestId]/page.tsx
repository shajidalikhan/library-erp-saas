'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/constants/routes';
import { platformApi } from '@/modules/platform/platform.service';
import { platformQueryKeys } from '@/modules/platform/platform-query-keys';

type DemoRequestDetail = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  libraryName: string;
  city: string;
  branchCount: number;
  studentCount: number;
  currentSystem: string;
  interestedFeatures: string[];
  notes: string;
  status: string;
  assignedTo: string | null;
  statusHistory: Array<{ status: string; note?: string; changedBy?: string | null; createdAt: string }>;
  adminNotes: Array<{ body: string; authorId?: string | null; createdAt: string }>;
  createdAt: string;
  updatedAt: string;
};

const STATUS_ACTIONS = [
  { label: 'Mark Contacted', status: 'CONTACTED' },
  { label: 'Mark Demo Scheduled', status: 'DEMO_SCHEDULED' },
  { label: 'Mark Converted', status: 'CONVERTED' },
  { label: 'Mark Rejected', status: 'REJECTED' },
] as const;

export default function PlatformDemoRequestDetailPage({ params }: { params: { requestId: string } }) {
  const queryClient = useQueryClient();
  const [assignedTo, setAssignedTo] = useState('');
  const [adminNote, setAdminNote] = useState('');

  const q = useQuery({
    queryKey: platformQueryKeys.demoRequest(params.requestId),
    queryFn: () => platformApi.demoRequest(params.requestId) as Promise<DemoRequestDetail>,
  });

  const patchMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      platformApi.patchDemoRequest(params.requestId, body),
    onSuccess: async () => {
      toast.success('Demo request updated');
      setAdminNote('');
      await queryClient.invalidateQueries({ queryKey: platformQueryKeys.demoRequest(params.requestId) });
      await queryClient.invalidateQueries({ queryKey: platformQueryKeys.all });
      await q.refetch();
    },
    onError: () => toast.error('Could not update demo request'),
  });

  const lead = q.data;

  if (q.isLoading) return <Skeleton className="h-72 w-full" />;
  if (q.isError || !lead) {
    return <p className="text-sm text-destructive">Could not load demo request.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={lead.libraryName}
        description={`${lead.fullName} · ${lead.city}`}
        actions={
          <Button variant="outline" asChild>
            <Link href={ROUTES.PLATFORM_DEMO_REQUESTS}>Back to demo requests</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge>{lead.status}</Badge>
        <span className="text-xs text-muted-foreground">
          Submitted {new Date(lead.createdAt).toLocaleString()}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6 rounded-lg border p-4">
          <section className="space-y-3">
            <h2 className="font-medium">Contact info</h2>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p><span className="text-muted-foreground">Name:</span> {lead.fullName}</p>
              <p><span className="text-muted-foreground">Email:</span> {lead.email}</p>
              <p><span className="text-muted-foreground">Phone:</span> {lead.phone}</p>
              <p><span className="text-muted-foreground">City:</span> {lead.city}</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-medium">Library info</h2>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p><span className="text-muted-foreground">Library:</span> {lead.libraryName}</p>
              <p><span className="text-muted-foreground">Branches:</span> {lead.branchCount}</p>
              <p><span className="text-muted-foreground">Students:</span> {lead.studentCount}</p>
              <p><span className="text-muted-foreground">Current system:</span> {lead.currentSystem || '—'}</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-medium">Requirements</h2>
            <p className="text-sm">
              {lead.interestedFeatures.length ? lead.interestedFeatures.join(', ') : 'No features selected'}
            </p>
            <p className="text-sm text-muted-foreground">{lead.notes || 'No additional notes provided.'}</p>
          </section>
        </div>

        <div className="space-y-4 rounded-lg border p-4">
          <h2 className="font-medium">Update lead</h2>
          <div className="flex flex-wrap gap-2">
            {STATUS_ACTIONS.map((action) => (
              <Button
                key={action.status}
                type="button"
                size="sm"
                variant={lead.status === action.status ? 'default' : 'outline'}
                loading={patchMutation.isPending}
                onClick={() => patchMutation.mutate({ status: action.status })}
              >
                {action.label}
              </Button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assignedTo">Assign owner (user id)</Label>
            <Input
              id="assignedTo"
              value={assignedTo || lead.assignedTo || ''}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="Super admin user id"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adminNote">Internal note</Label>
            <textarea
              id="adminNote"
              rows={4}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              className="flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Add context for the sales team"
            />
          </div>
          <Button
            className="w-full"
            loading={patchMutation.isPending}
            onClick={() =>
              patchMutation.mutate({
                ...(assignedTo ? { assignedTo } : {}),
                ...(adminNote ? { adminNote } : {}),
              })
            }
          >
            Save note / assignment
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="mb-3 font-medium">Timeline</h2>
          <ul className="space-y-3 text-sm">
            {lead.statusHistory.map((event, index) => (
              <li key={`${event.createdAt}-${index}`} className="border-l-2 border-primary/30 pl-3">
                <p className="font-medium">{event.status}</p>
                {event.note ? <p className="text-muted-foreground">{event.note}</p> : null}
                <p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="mb-3 font-medium">Internal notes</h2>
          <ul className="space-y-3 text-sm">
            {lead.adminNotes.length ? (
              lead.adminNotes.map((note, index) => (
                <li key={`${note.createdAt}-${index}`} className="rounded-md bg-muted/40 p-3">
                  <p>{note.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(note.createdAt).toLocaleString()}</p>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">No internal notes yet.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
