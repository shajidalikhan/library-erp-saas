'use client';

import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormMessage } from '@/components/ui/form-message';
import { ROUTES } from '@/constants/routes';
import { ApiError } from '@/lib/api-error';
import { useAuth } from '@/hooks/use-auth';

import { loginSchema, type LoginFormValues } from '../auth.validation';

export function LoginForm() {
  const { login, loginState } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await login(values);
      toast.success('Welcome back!');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 401) {
          setError('root', { message: err.message });
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error('Something went wrong, please try again');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to your workspace to continue.
        </p>
      </div>

      {errors.root ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{errors.root.message}</span>
        </div>
      ) : null}

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

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href={ROUTES.FORGOT_PASSWORD}
            className="text-xs font-medium text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter your password"
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

      <Button
        type="submit"
        className="h-10 w-full min-w-[9.5rem] shrink-0"
        loading={isSubmitting || loginState.isPending}
      >
        {isSubmitting || loginState.isPending ? (
          'Signing in...'
        ) : (
          <>
            <LogIn className="h-4 w-4 shrink-0" aria-hidden />
            Sign in
          </>
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Need access?{' '}
        <Link href={ROUTES.REQUEST_DEMO} className="font-medium text-primary hover:underline">
          Request a demo
        </Link>
      </p>
    </form>
  );
}
