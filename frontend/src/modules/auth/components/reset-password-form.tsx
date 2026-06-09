'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Eye, EyeOff, KeyRound, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormMessage } from '@/components/ui/form-message';
import { ROUTES } from '@/constants/routes';
import { ApiError } from '@/lib/api-error';

import { authService } from '../auth.service';
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from '../auth.validation';

export function ResetPasswordForm() {
  const params = useSearchParams();
  const tokenFromUrl = params.get('token') ?? '';
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: tokenFromUrl, password: '', confirmPassword: '' },
  });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (!tokenFromUrl) {
      setError('token', { message: 'Missing or invalid reset token' });
      return;
    }
    try {
      await authService.resetPassword({ token: values.token, password: values.password });
      setDone(true);
      toast.success('Password updated. Please sign in.');
    } catch (err) {
      if (err instanceof ApiError) {
        setError('root', { message: err.message });
      } else {
        toast.error('Something went wrong, please try again');
      }
    }
  };

  if (done) {
    return (
      <div className="space-y-5">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Password updated</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your password has been changed. You can now sign in with your new password.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href={ROUTES.LOGIN}>Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a strong password you haven&apos;t used before.
        </p>
      </div>

      {errors.root ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{errors.root.message}</span>
        </div>
      ) : null}

      {!tokenFromUrl ? (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            We couldn&apos;t find a reset token in the URL. Please request a new
            reset link from the{' '}
            <Link
              href={ROUTES.FORGOT_PASSWORD}
              className="font-medium underline-offset-2 hover:underline"
            >
              forgot-password page
            </Link>
            .
          </span>
        </div>
      ) : null}

      <input type="hidden" {...register('token')} />

      <div className="space-y-1.5">
        <Label htmlFor="password">New password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Min 8 chars, upper/lower/number"
            hasError={!!errors.password}
            className="pr-10"
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <FormMessage>{errors.password?.message}</FormMessage>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Repeat the password"
          hasError={!!errors.confirmPassword}
          {...register('confirmPassword')}
        />
        <FormMessage>{errors.confirmPassword?.message}</FormMessage>
      </div>

      <Button type="submit" className="w-full" loading={isSubmitting}>
        <KeyRound className="h-4 w-4" />
        Update password
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href={ROUTES.LOGIN}
          className="font-medium text-primary hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
