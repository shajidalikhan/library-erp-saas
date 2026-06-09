import { request } from '@/lib/axios';

import type { RequestDemoFormValues } from './demo-request.validation';

export const demoRequestApi = {
  create: (body: RequestDemoFormValues) =>
    request<{ id: string }>({
      url: '/demo-requests',
      method: 'POST',
      data: body,
      _skipAuth: true,
    }),
};
