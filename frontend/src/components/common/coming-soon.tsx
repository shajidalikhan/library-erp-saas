import { Sparkles } from 'lucide-react';

import { EmptyState } from './empty-state';
import { PageHeader } from './page-header';

interface ComingSoonProps {
  title: string;
  description?: string;
}

/**
 * Lightweight placeholder for module screens whose backend isn't built yet.
 * Replace with the real screen as each module is implemented.
 */
export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={Sparkles}
        title="Coming soon"
        description="This module is being built. Permissions and navigation are already in place."
      />
    </div>
  );
}
