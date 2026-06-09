import { z } from 'zod';
import { Types } from 'mongoose';

import { SHIFT_ASSIGNMENT_STATUS } from '@modules/shifts/shift.constants';

export const objectIdString = z
  .string()
  .trim()
  .refine((id) => Types.ObjectId.isValid(id), { message: 'Invalid ObjectId' });

export const createSeatAssignmentSchema = z.object({
  seatId: objectIdString,
  studentId: objectIdString,
  shiftId: objectIdString,
  membershipId: objectIdString.optional().nullable(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().nullable().optional(),
  status: z
    .enum([
      SHIFT_ASSIGNMENT_STATUS.ACTIVE,
      SHIFT_ASSIGNMENT_STATUS.RESERVED,
    ])
    .optional(),
});

export const updateSeatAssignmentSchema = z.object({
  studentId: objectIdString.optional(),
  shiftId: objectIdString.optional(),
  membershipId: objectIdString.optional().nullable(),
  endDate: z.coerce.date().nullable().optional(),
  status: z.enum(Object.values(SHIFT_ASSIGNMENT_STATUS) as [string, ...string[]]).optional(),
});

export const seatAssignmentIdParamsSchema = z.object({
  assignmentId: objectIdString,
});

export const seatGridQuerySchema = z.object({
  branchId: objectIdString,
  floor: z.string().trim().max(40).optional(),
  zone: z.string().trim().max(80).optional(),
});

export type CreateSeatAssignmentInput = z.infer<typeof createSeatAssignmentSchema>;
export type UpdateSeatAssignmentInput = z.infer<typeof updateSeatAssignmentSchema>;
