import { z } from 'zod';
import { Types } from 'mongoose';

import { ANALYTICS_RANGE_PRESETS } from './analytics.constants';

const objectIdString = z
  .string()
  .trim()
  .refine((id) => Types.ObjectId.isValid(id), { message: 'Invalid ObjectId' });

export const analyticsQuerySchema = z.object({
  libraryId: objectIdString.optional(),
  branchId: objectIdString.optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  range: z.enum(ANALYTICS_RANGE_PRESETS).optional().default('30d'),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
