import { Badge } from '@/components/ui/badge';

import type { PaymentMethod } from '../types';

export function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  return (
    <Badge variant="outline" className="font-mono text-xs">
      {method.replace(/_/g, ' ')}
    </Badge>
  );
}
