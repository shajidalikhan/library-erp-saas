'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PERMISSIONS } from '@/constants/permissions';
import { userDetailRoute } from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { ApiError } from '@/lib/api-error';
import { usersApi } from '@/modules/users/users.service';

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const userId = String(params.userId ?? '');
  const { canAny } = usePermissions();
  const canEdit = canAny([PERMISSIONS.USER_UPDATE, PERMISSIONS.STAFF_UPDATE]);

  const { data, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersApi.get(userId),
    enabled: Boolean(userId) && canEdit,
  });

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    setInitialized(false);
  }, [userId]);

  useEffect(() => {
    if (!data || initialized) return;
    setFullName(data.fullName);
    setEmail(data.email);
    setPhone(data.phone ?? '');
    setIsActive(data.isActive);
    setInitialized(true);
  }, [data, initialized]);

  if (!canEdit) {
    return <p className="text-sm text-muted-foreground">No access.</p>;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await usersApi.update(userId, {
        fullName,
        email,
        phone: phone.trim() || undefined,
        isActive,
        password: password.trim() ? password : undefined,
      });
      toast.success('User updated');
      await qc.invalidateQueries({ queryKey: ['user', userId] });
      await qc.invalidateQueries({ queryKey: ['users'] });
      router.push(userDetailRoute(userId));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit user"
        description={data?.email ?? ''}
        actions={
          <Button variant="outline" asChild>
            <Link href={userDetailRoute(userId)}>Cancel</Link>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <form className="max-w-md space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="fn">Full name</Label>
                <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="em">Email</Label>
                <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ph">Phone</Label>
                <Input id="ph" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw">New password (optional)</Label>
                <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                Active
              </label>
              <Button type="submit" loading={submitting}>
                Save
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
