import { z } from 'zod';
import { Types } from 'mongoose';

import { mediaAssetSchemaZod } from '@utils/media-asset.validation';

import { STUDENT_GENDER, STUDENT_SORT_FIELDS, STUDENT_STATUS } from './student.constants';

const documentProofAssetSchema = mediaAssetSchemaZod.extend({
  fileType: z.string().trim().max(64).optional(),
});

const objectIdString = z
  .string()
  .trim()
  .refine((id) => Types.ObjectId.isValid(id), { message: 'Invalid ObjectId' });

const optionalObjectId = z
  .union([objectIdString, z.literal('').transform(() => undefined), z.null()])
  .optional();

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+0-9 ()-]{7,20}$/, 'Invalid phone format')
  .optional();

const emailSchema = z.string().trim().toLowerCase().email('Invalid email format');

export const listStudentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.string().trim().max(200).optional(),
  sortBy: z.enum(STUDENT_SORT_FIELDS).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  status: z.enum([STUDENT_STATUS.ACTIVE, STUDENT_STATUS.INACTIVE, STUDENT_STATUS.SUSPENDED]).optional(),
  branchId: objectIdString.optional(),
  libraryId: objectIdString.optional(),
  membershipExpiresBefore: z.coerce.date().optional(),
  membershipExpiresAfter: z.coerce.date().optional(),
  membershipEndFrom: z.coerce.date().optional(),
  membershipEndTo: z.coerce.date().optional(),
  membershipStatus: z.enum(['ACTIVE', 'SUSPENDED', 'EXPIRED']).optional(),
  expiringIn: z.enum(['1-3', '4-7']).optional(),
  membershipExpired: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  membershipFilter: z
    .enum(['active', 'expired', 'expiring1to3', 'expiring4to7', 'expiredToday'])
    .optional(),
  shiftId: objectIdString.optional(),
});

export const studentIdParamsSchema = z.object({
  studentId: objectIdString,
});

export const createStudentBaseSchema = z.object({
  branchId: objectIdString,
  studentId: z.string().trim().min(3).max(64).optional(),
  fullName: z.string().trim().min(2).max(120),
  email: emailSchema,
  createLoginAccount: z.coerce.boolean().optional().default(false),
  temporaryPassword: z.string().trim().min(8).max(128).optional(),
  phone: phoneSchema,
  gender: z.enum([
    STUDENT_GENDER.MALE,
    STUDENT_GENDER.FEMALE,
    STUDENT_GENDER.OTHER,
    STUDENT_GENDER.UNSPECIFIED,
  ]).optional(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  pincode: z.string().trim().max(16).optional(),
  emergencyContactName: z.string().trim().max(120).optional(),
  emergencyContactPhone: phoneSchema,
  guardianName: z.string().trim().max(120).optional(),
  guardianPhone: phoneSchema,
  aadhaarNumber: z.string().trim().max(20).optional(),
  admissionDate: z.coerce.date().optional(),
  membershipStartDate: z.coerce.date().optional(),
  membershipEndDate: z.coerce.date().optional().nullable(),
  status: z
    .enum([STUDENT_STATUS.ACTIVE, STUDENT_STATUS.INACTIVE, STUDENT_STATUS.SUSPENDED])
    .optional(),
  notes: z.string().trim().max(5000).optional(),
  assignedSeatId: optionalObjectId,
  shiftId: objectIdString.optional(),
  profilePhoto: mediaAssetSchemaZod.optional(),
  documentProof: documentProofAssetSchema.optional(),
});

export const createStudentSchema = createStudentBaseSchema.superRefine((v, ctx) => {
  if (v.createLoginAccount && !v.temporaryPassword) {
    ctx.addIssue({
      code: 'custom',
      message: 'temporaryPassword is required when createLoginAccount is true',
      path: ['temporaryPassword'],
    });
  }
});

export const updateStudentSchema = createStudentBaseSchema
  .omit({ branchId: true, studentId: true, createLoginAccount: true, temporaryPassword: true })
  .partial()
  .extend({
    studentId: z.string().trim().min(3).max(64).optional(),
  });

export const transferStudentSchema = z.object({
  branchId: objectIdString,
});

export const assignSeatSchema = z.object({
  /** Set to `null` to clear the assignment. */
  assignedSeatId: z.union([objectIdString, z.null()]),
  /** Required when assigning a seat (shift-wise occupancy). */
  shiftId: objectIdString.optional(),
});

export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type TransferStudentInput = z.infer<typeof transferStudentSchema>;
export type AssignSeatInput = z.infer<typeof assignSeatSchema>;
