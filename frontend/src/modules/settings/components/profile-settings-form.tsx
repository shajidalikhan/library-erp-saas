'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore, selectUser } from '@/store/auth.store';
import { settingsApi } from '../settings.service';
import { settingsQueryKeys } from '../settings-query-keys';

export function ProfileSettingsForm() {
  const qc = useQueryClient();
  const storeUser = useAuthStore(selectUser);
  const setUser = useAuthStore((s) => s.setUser);

  const q = useQuery({
    queryKey: settingsQueryKeys.profile(),
    queryFn: () => settingsApi.getProfile(),
    initialData: storeUser ?? undefined,
  });

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (q.data) {
      setFullName(q.data.fullName ?? '');
      setPhone(q.data.phone ?? '');
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () =>
      settingsApi.patchProfile({
        fullName: fullName.trim(),
        phone: phone.trim() || null,
      }),
    onSuccess: (user) => {
      setUser(user);
      toast.success('Profile updated');
      void qc.invalidateQueries({ queryKey: settingsQueryKeys.profile() });
    },
    onError: () => toast.error('Could not save profile'),
  });

  if (q.isLoading && !q.data) {
    return <Skeleton className="h-64 w-full max-w-xl" />;
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your name and contact details.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground"
            aria-hidden
          >
            {(fullName || 'U').slice(0, 1).toUpperCase()}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={q.data?.email ?? ''} readOnly disabled className="bg-muted" />
          </div>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
