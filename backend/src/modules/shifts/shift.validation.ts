import { z } from 'zod';
import { Types } from 'mongoose';

import { SEAT_TYPES } from '@modules/seats/seat.constants';
import { SHIFT_KINDS } from './shift.constants';

export const objectIdString = z
  .string()
  .trim()
  .refine((id) => Types.ObjectId.isValid(id), { message: 'Invalid ObjectId' });

export const createShiftSchema = z.object({
  libraryId: objectIdString,
  branchId: objectIdString,
  name: z.string().trim().min(2).max(80),
  startTime: z.string().trim().regex(/^\d{2}:\d{2}$/, 'Use HH:mm format'),
  endTime: z.string().trim().regex(/^\d{2}:\d{2}$/, 'Use HH:mm format'),
  type: z.enum(SHIFT_KINDS).optional().default('CUSTOM'),
  color: z
    .string()
    .trim()
    .max(16)
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Use hex color e.g. #3b82f6')
    .optional()
    .default('#3b82f6'),
  description: z.string().trim().max(500).optional(),
  active: z.coerce.boolean().optional().default(true),
  allowedSeatTypes: z.array(z.enum(SEAT_TYPES)).optional(),
  priceMultiplier: z.coerce.number().min(0).optional().default(1),
});

export const updateShiftSchema = createShiftSchema
  .omit({ libraryId: true, branchId: true })
  .partial();

export const listShiftsQuerySchema = z.object({
  libraryId: objectIdString.optional(),
  branchId: objectIdString.optional(),
  active: z.enum(['true', 'false']).optional(),
});

export type CreateShiftInput = z.infer<typeof createShiftSchema>;
export type UpdateShiftInput = z.infer<typeof updateShiftSchema>;
export type ListShiftsQuery = z.infer<typeof listShiftsQuerySchema>;
