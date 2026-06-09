'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { libraryApi, type BranchDeleteImpact } from '@/modules/library/library.service';

export function DeleteBranchDialog({
  open,
  onOpenChange,
  libraryId,
  branchId,
  branchName,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  libraryId: string;
  branchId: string;
  branchName: string;
  onConfirm: () => void;
  loading?: boolean;
}) {
  const [phrase, setPhrase] = useState('');
  const [impact, setImpact] = useState<BranchDeleteImpact | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setPhrase('');
      setImpact(null);
      return;
    }
    setImpactLoading(true);
    void libraryApi
      .getBranchDeleteImpact(libraryId, branchId)
      .then(setImpact)
      .catch(() => setImpact(null))
      .finally(() => setImpactLoading(false));
  }, [open, libraryId, branchId]);

  const valid = phrase.trim() === 'DELETE';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete branch &quot;{branchName}&quot;?</DialogTitle>
          <DialogDescription>
            Permanently removes this branch, its seats, students, attendance, branch payments, and
            uploaded assets.
          </DialogDescription>
        </DialogHeader>
        {impactLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : impact ? (
          <ul className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
            <li>{impact.students} students will be removed</li>
            <li>{impact.seats} seats will be removed</li>
            <li>{impact.staff} staff accounts will be removed</li>
          </ul>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="delete-branch-phrase">Type DELETE to confirm</Label>
          <Input
            id="delete-branch-phrase"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!valid || loading}
            onClick={onConfirm}
          >
            {loading ? 'Deleting…' : 'Delete branch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
