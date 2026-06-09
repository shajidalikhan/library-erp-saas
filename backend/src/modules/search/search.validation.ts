import { z } from 'zod';

export const globalSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(30).optional().default(12),
});

export type GlobalSearchQuery = z.infer<typeof globalSearchQuerySchema>;
