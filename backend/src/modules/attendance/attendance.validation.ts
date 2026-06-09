import { Types } from 'mongoose';
import { z } from 'zod';

import { ATTENDANCE_METHOD, ATTENDANCE_SORT_FIELDS, ATTENDANCE_STATUS, CHECKOUT_SOURCE } from './attendance.constants';

const objectIdString = z
  .string()
  .trim()
  .refine((id) => Types.ObjectId.isValid(id), { message: 'Invalid ObjectId' });

const optionalObjectId = z
  .union([objectIdString, z.literal('').transform(() => undefined), z.undefined()])
  .optional();

export const attendanceIdParamsSchema = z.object({
  attendanceId: objectIdString,
});

export const studentIdParamsSchema = z.object({
  studentId: objectIdString,
});

export const checkInBodySchema = z.object({
  studentId: objectIdString,
  libraryId: optionalObjectId,
  branchId: optionalObjectId,
  seatId: optionalObjectId,
  method: z.enum(ATTENDANCE_METHOD).optional().default('MANUAL'),
  notes: z.string().trim().max(1000).optional(),
  checkInAt: z.coerce.date().optional(),
});

export const checkOutBodySchema = z.object({
  studentId: objectIdString,
  libraryId: optionalObjectId,
  branchId: optionalObjectId,
  checkOutAt: z.coerce.date().optional(),
  checkOutSource: z.enum(CHECKOUT_SOURCE).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const attendanceQrTokenBodySchema = z.object({
  qrToken: z.string().trim().min(20).max(12_000),
});

export const manualEntryBodySchema = z
  .object({
    studentId: objectIdString,
    seatId: optionalObjectId,
    date: z.coerce.date().optional(),
    checkInAt: z.coerce.date().optional().nullable(),
    checkOutAt: z.coerce.date().optional().nullable(),
    status: z.enum(ATTENDANCE_STATUS).optional(),
    method: z.enum(ATTENDANCE_METHOD).optional().default('MANUAL'),
    notes: z.string().trim().max(1000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.checkInAt && v.checkOutAt && v.checkOutAt < v.checkInAt) {
      ctx.addIssue({
        code: 'custom',
        message: 'checkOutAt must be after checkInAt',
        path: ['checkOutAt'],
      });
    }
  });

export const updateAttendanceBodySchema = z.object({
  status: z.enum(ATTENDANCE_STATUS).optional(),
  notes: z.string().trim().max(1000).optional(),
  checkInAt: z.coerce.date().optional().nullable(),
  checkOutAt: z.coerce.date().optional().nullable(),
  method: z.enum(ATTENDANCE_METHOD).optional(),
});

export const attendanceListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.string().trim().max(200).optional(),
  libraryId: optionalObjectId,
  branchId: optionalObjectId,
  studentId: optionalObjectId,
  seatId: optionalObjectId,
  shiftId: optionalObjectId,
  status: z.enum(ATTENDANCE_STATUS).optional(),
  method: z.enum(ATTENDANCE_METHOD).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  activeOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  sortBy: z.enum(ATTENDANCE_SORT_FIELDS).optional().default('date'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const attendanceSummaryQuerySchema = z.object({
  libraryId: optionalObjectId,
  branchId: optionalObjectId,
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const attendanceBoardQuerySchema = z.object({
  libraryId: optionalObjectId,
  branchId: optionalObjectId,
  date: z.coerce.date().optional(),
  shiftId: optionalObjectId,
  mode: z.enum(['students', 'grid']).optional(),
});

export type AttendanceBoardQuery = z.infer<typeof attendanceBoardQuerySchema>;

export type CheckInInput = z.infer<typeof checkInBodySchema>;
export type CheckOutInput = z.infer<typeof checkOutBodySchema>;
export type AttendanceQrTokenInput = z.infer<typeof attendanceQrTokenBodySchema>;
export type ManualEntryInput = z.infer<typeof manualEntryBodySchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceBodySchema>;
export type AttendanceListQuery = z.infer<typeof attendanceListQuerySchema>;
export type AttendanceSummaryQuery = z.infer<typeof attendanceSummaryQuerySchema>;
