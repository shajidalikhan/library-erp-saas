'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, MailCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormMessage } from '@/components/ui/form-message';
import { ROUTES } from '@/constants/routes';
import { ApiError } from '@/lib/api-error';

import { authService } from '../auth.service';
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from '../auth.validation';

/**
 * Forgot-password flow wired to POST /auth/forgot-password.
 */
export function ForgotPasswordForm() {
  const [sent, setSent] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    try {
      await authService.forgotPassword(values.email);
      setSent(values.email);
      toast.success('If an account exists, reset instructions have been sent.');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Something went wrong, please try again');
      }
    }
  };

  if (sent) {
    return (
      <div className="space-y-5">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            If <span className="font-medium text-foreground">{sent}</span> matches
            an account, you&apos;ll receive an email with a link to reset your
            password.
          </p>
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href={ROUTES.LOGIN}>Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Forgot password?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the email tied to your account and we&apos;ll send you a link to
          reset it.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@library.com"
          hasError={!!errors.email}
          {...register('email')}
        />
        <FormMessage>{errors.email?.message}</FormMessage>
      </div>

      <Button type="submit" className="w-full" loading={isSubmitting}>
        <Mail className="h-4 w-4" />
        Send reset link
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link
          href={ROUTES.LOGIN}
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
