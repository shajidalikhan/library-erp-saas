import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { InvoiceStatus } from '../types';

const variants: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  UNPAID: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  PARTIAL: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  PAID: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  OVERDUE: 'bg-destructive/15 text-destructive',
  CANCELLED: 'bg-muted text-muted-foreground line-through',
  REFUNDED: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge variant="secondary" className={cn('font-medium', variants[status])}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}
