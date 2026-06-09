import { z } from 'zod';
import { Types } from 'mongoose';

const objectIdString = z
  .string()
  .trim()
  .refine((id) => Types.ObjectId.isValid(id), { message: 'Invalid ObjectId' });

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+0-9 ()-]{7,20}$/, 'Invalid phone format');

export const publicSlugParamsSchema = z.object({
  slug: z.string().trim().min(2).max(160),
});

export const publicAvailabilityQuerySchema = z.object({
  branchId: objectIdString,
  shiftId: objectIdString,
  date: z.coerce.date().optional(),
});

export const createPublicBookingBodySchema = z.object({
  branchId: objectIdString,
  shiftId: objectIdString,
  seatId: objectIdString,
  feePlanId: objectIdString,
  fullName: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().email().optional(),
  guardianName: z.string().trim().min(2).max(120).optional(),
  guardianPhone: phoneSchema.optional(),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  pincode: z.string().trim().max(16).optional(),
  notes: z.string().trim().max(2000).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const listBookingsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  libraryId: objectIdString.optional(),
  branchId: objectIdString.optional(),
  bookingStatus: z
    .enum(['HOLD', 'EXPIRED', 'APPROVED', 'REJECTED', 'CONVERTED', 'RELEASED_BY_STAFF'])
    .optional(),
  paymentStatus: z.enum(['NOT_REQUIRED', 'PENDING_OFFLINE']).optional(),
  shiftId: objectIdString.optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  search: z.string().trim().max(120).optional(),
});

export const bookingIdParamsSchema = z.object({
  bookingId: objectIdString,
});

export const rejectBookingBodySchema = z.object({
  reason: z.string().trim().min(2).max(500).optional(),
});

export const releasePublicHoldBodySchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export const bookingPrefillParamsSchema = z.object({
  bookingId: objectIdString,
});

export type PublicSlugParams = z.infer<typeof publicSlugParamsSchema>;
export type PublicAvailabilityQuery = z.infer<typeof publicAvailabilityQuerySchema>;
export type CreatePublicBookingInput = z.infer<typeof createPublicBookingBodySchema>;
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;
