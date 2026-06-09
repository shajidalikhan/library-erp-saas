import { z } from 'zod';

import { paginationQuerySchema } from '@modules/payments/payment.validation';

const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const recentActivityQuerySchema = paginationQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(50).optional().default(15),
  libraryId: objectIdString.optional(),
  branchId: objectIdString.optional(),
});

export type RecentActivityQuery = z.infer<typeof recentActivityQuerySchema>;
