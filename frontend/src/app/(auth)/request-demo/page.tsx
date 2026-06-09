import type { Metadata } from 'next';

import { RequestDemoForm } from '@/modules/demo-requests/components/request-demo-form';

export const metadata: Metadata = {
  title: 'Request a demo',
  description: 'Request a guided Library ERP walkthrough for your study library network.',
};

export default function RequestDemoPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <RequestDemoForm />
    </div>
  );
}
