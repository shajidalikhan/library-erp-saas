'use client';

import { useState } from 'react';

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

export function DeleteLibraryDialog({
  open,
  onOpenChange,
  libraryName,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  libraryName: string;
  onConfirm: (confirmPhrase: string) => void;
  loading?: boolean;
}) {
  const [phrase, setPhrase] = useState('');
  const expected = `DELETE ${libraryName}`;
  const valid = phrase.trim() === expected;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete library permanently?</DialogTitle>
          <DialogDescription>
            This removes all branches, students, staff, seats, attendance, payments, invoices,
            notifications, and Cloudinary assets. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="delete-library-phrase">
            Type <span className="font-mono font-semibold">{expected}</span> to confirm
          </Label>
          <Input
            id="delete-library-phrase"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder={expected}
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
            onClick={() => onConfirm(phrase.trim())}
          >
            {loading ? 'Deleting…' : 'Delete library'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
