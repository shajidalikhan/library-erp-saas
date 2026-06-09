import { z } from 'zod';
import { Types } from 'mongoose';

import { SEAT_STATUSES, SEAT_TYPES, SHIFT_TYPES } from './seat.constants';

export const objectIdString = z
  .string()
  .trim()
  .refine((id) => Types.ObjectId.isValid(id), { message: 'Invalid ObjectId' });

const optionalObjectId = z
  .union([objectIdString, z.literal('').transform(() => undefined), z.undefined()])
  .optional();

export const createSeatBodySchema = z.object({
  libraryId: objectIdString,
  branchId: objectIdString,
  seatNumber: z.string().trim().min(1).max(40),
  floor: z.string().trim().min(1).max(40).optional().default('1'),
  zone: z.string().trim().min(1).max(80).optional().default('General'),
  seatType: z.enum(SEAT_TYPES).optional().default('STANDARD'),
  notes: z.string().trim().max(500).optional(),
  status: z.enum(SEAT_STATUSES).optional().default('AVAILABLE'),
  reservedUntil: z.coerce.date().nullable().optional(),
  active: z.coerce.boolean().optional().default(true),
});

export const updateSeatBodySchema = z.object({
  seatNumber: z.string().trim().min(1).max(40).optional(),
  floor: z.string().trim().min(1).max(40).optional(),
  zone: z.string().trim().min(1).max(80).optional(),
  seatType: z.enum(SEAT_TYPES).optional(),
  notes: z.string().trim().max(500).optional(),
  status: z.enum(SEAT_STATUSES).optional(),
  reservedUntil: z.coerce.date().nullable().optional(),
  active: z.coerce.boolean().optional(),
});

export const assignSeatBodySchema = z.object({
  studentId: objectIdString,
  shiftId: objectIdString,
});

export const bulkCreateSeatsBodySchema = z
  .object({
    libraryId: objectIdString,
    branchId: objectIdString,
    prefix: z.string().trim().max(10).optional().default(''),
    startNumber: z.coerce.number().int().min(1).max(99999),
    endNumber: z.coerce.number().int().min(1).max(99999),
    floor: z.string().trim().min(1).max(40).default('1'),
    zone: z.string().trim().min(1).max(80).default('General'),
    seatType: z.enum(SEAT_TYPES).default('STANDARD'),
    padLength: z.coerce.number().int().min(0).max(6).optional().default(0),
  })
  .superRefine((data, ctx) => {
    if (data.endNumber < data.startNumber) {
      ctx.addIssue({ code: 'custom', message: 'endNumber must be >= startNumber', path: ['endNumber'] });
    }
    const count = data.endNumber - data.startNumber + 1;
    if (count > 500) {
      ctx.addIssue({ code: 'custom', message: 'Cannot create more than 500 seats per request', path: ['endNumber'] });
    }
  });

export const listSeatsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.string().trim().max(100).optional(),
  libraryId: optionalObjectId,
  branchId: optionalObjectId,
  floor: z.string().trim().max(40).optional(),
  zone: z.string().trim().max(80).optional(),
  shiftType: z.enum(SHIFT_TYPES).optional(),
  shiftId: optionalObjectId,
  seatType: z.enum(SEAT_TYPES).optional(),
  status: z.enum(SEAT_STATUSES).optional(),
  occupied: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  sortBy: z
    .enum(['seatNumber', 'floor', 'zone', 'status', 'createdAt', 'updatedAt'])
    .optional()
    .default('seatNumber'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

export const seatIdParamsSchema = z.object({
  seatId: objectIdString,
});

export const occupancySummaryQuerySchema = z.object({
  libraryId: optionalObjectId,
  branchId: optionalObjectId,
});

export type CreateSeatInput = z.infer<typeof createSeatBodySchema>;
export type UpdateSeatInput = z.infer<typeof updateSeatBodySchema>;
export type AssignSeatInput = z.infer<typeof assignSeatBodySchema>;
export type BulkCreateSeatsInput = z.infer<typeof bulkCreateSeatsBodySchema>;
export type ListSeatsQuery = z.infer<typeof listSeatsQuerySchema>;
export type OccupancySummaryQuery = z.infer<typeof occupancySummaryQuerySchema>;
