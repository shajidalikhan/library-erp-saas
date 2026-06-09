import { z } from 'zod';
import { Types } from 'mongoose';

import { ROLES, type RoleName } from '@constants/roles.constants';
import { provisionPasswordSchema } from '@modules/auth/auth.validation';
import { USER_STATUS } from './users.constants';

const objectIdString = z
  .string()
  .trim()
  .refine((id) => Types.ObjectId.isValid(id), { message: 'Invalid ObjectId' });

const optionalObjectId = z
  .union([objectIdString, z.literal('').transform(() => undefined), z.undefined()])
  .optional();

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+0-9 ()-]{7,20}$/, 'Invalid phone format')
  .optional();

const emailSchema = z.string().trim().toLowerCase().email('Invalid email format');

/** Roles SUPER_ADMIN may assign when creating users (not STUDENT — use Students module). */
export const superAdminCreatableRoleSchema = z.enum([
  ROLES.SUPER_ADMIN,
  ROLES.LIBRARY_OWNER,
  ROLES.MANAGER,
  ROLES.RECEPTIONIST,
  ROLES.ACCOUNTANT,
  ROLES.SECURITY,
]);

/** Staff accounts library owners may create (not STUDENT — use Students module). */
export const ownerCreatableRoleSchema = z.enum([
  ROLES.MANAGER,
  ROLES.RECEPTIONIST,
  ROLES.ACCOUNTANT,
  ROLES.SECURITY,
]);

/** Branch-scoped staff created via POST /users (libraryId + branchId required). */
const USERS_MODULE_STAFF_ROLES: RoleName[] = [
  ROLES.MANAGER,
  ROLES.RECEPTIONIST,
  ROLES.ACCOUNTANT,
  ROLES.SECURITY,
];

export const createUserBodySchema = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    email: emailSchema,
    phone: phoneSchema,
    password: provisionPasswordSchema,
    isActive: z.coerce.boolean().optional().default(true),
    role: z.string().trim().min(1),
    libraryId: optionalObjectId,
    branchId: optionalObjectId,
  })
  .superRefine((data, ctx) => {
    const role = data.role as RoleName;
    const isSuperSet = superAdminCreatableRoleSchema.safeParse(role).success;
    const isOwnerSet = ownerCreatableRoleSchema.safeParse(role).success;
    if (!isSuperSet && !isOwnerSet) {
      ctx.addIssue({ code: 'custom', message: 'Invalid role', path: ['role'] });
      return;
    }
    if (role === ROLES.SUPER_ADMIN) {
      if (data.libraryId) {
        ctx.addIssue({ code: 'custom', message: 'libraryId must be empty for SUPER_ADMIN', path: ['libraryId'] });
      }
      if (data.branchId) {
        ctx.addIssue({ code: 'custom', message: 'branchId must be empty for SUPER_ADMIN', path: ['branchId'] });
      }
      return;
    }
    if (role === ROLES.LIBRARY_OWNER) {
      if (!data.libraryId) {
        ctx.addIssue({ code: 'custom', message: 'libraryId is required for LIBRARY_OWNER', path: ['libraryId'] });
      }
      if (data.branchId) {
        ctx.addIssue({ code: 'custom', message: 'branchId must be empty for LIBRARY_OWNER', path: ['branchId'] });
      }
      return;
    }
    if (USERS_MODULE_STAFF_ROLES.includes(role)) {
      if (!data.libraryId) {
        ctx.addIssue({ code: 'custom', message: 'libraryId is required for this role', path: ['libraryId'] });
      }
      if (!data.branchId) {
        ctx.addIssue({ code: 'custom', message: 'branchId is required for this role', path: ['branchId'] });
      }
    }
  });

export const updateUserBodySchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  email: emailSchema.optional(),
  phone: phoneSchema,
  isActive: z.coerce.boolean().optional(),
  password: provisionPasswordSchema.optional(),
  role: z.string().trim().min(1).optional(),
  libraryId: optionalObjectId,
  branchId: optionalObjectId,
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.string().trim().max(200).optional(),
  libraryId: optionalObjectId,
  branchId: optionalObjectId,
  role: z.string().trim().max(64).optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  status: z.enum([USER_STATUS.ACTIVE, USER_STATUS.INACTIVE, USER_STATUS.SUSPENDED, USER_STATUS.DELETED]).optional(),
  includeInactive: z.coerce.boolean().optional().default(false),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'fullName', 'email']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const userIdParamsSchema = z.object({
  userId: objectIdString,
});

export const deleteUserBodySchema = z.object({
  confirm: z.literal('DELETE'),
});

export type CreateUserInput = z.infer<typeof createUserBodySchema>;
export type UpdateUserInput = z.infer<typeof updateUserBodySchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
