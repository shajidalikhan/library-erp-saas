import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Inline form error message - used directly under a labelled field.
 * Pair with React Hook Form's `formState.errors`:
 *
 *   <FormMessage>{errors.email?.message}</FormMessage>
 */
export function FormMessage({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className={cn(
        'mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive',
        className,
      )}
    >
      <AlertCircle className="h-3.5 w-3.5" aria-hidden />
      {children}
    </p>
  );
}
