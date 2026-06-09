import { z } from 'zod';

import { paginationQuerySchema } from '@modules/payments/payment.validation';

import {
  DEMO_REQUEST_FEATURES,
  DEMO_REQUEST_STATUSES,
} from './demo-request.constants';

const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const sanitizedString = (min: number, max: number) =>
  z
    .string({ error: 'Required' })
    .trim()
    .min(min)
    .max(max)
    .transform((v) => v.replace(/\s+/g, ' '));

const emailSchema = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .email('Invalid email format')
  .max(200);

const phoneSchema = z
  .string({ error: 'Phone is required' })
  .trim()
  .min(8, 'Phone number is too short')
  .max(20, 'Phone number is too long')
  .regex(/^[+]?[\d\s()-]{8,20}$/, 'Invalid phone number');

export const createDemoRequestSchema = z.object({
  fullName: sanitizedString(2, 120),
  email: emailSchema,
  phone: phoneSchema,
  libraryName: sanitizedString(2, 160),
  city: sanitizedString(2, 120),
  branchCount: z.coerce.number().int().min(1).max(500),
  studentCount: z.coerce.number().int().min(1).max(1_000_000),
  currentSystem: sanitizedString(0, 160).optional().default(''),
  interestedFeatures: z
    .array(z.enum(DEMO_REQUEST_FEATURES))
    .max(DEMO_REQUEST_FEATURES.length)
    .default([]),
  notes: sanitizedString(0, 4000).optional().default(''),
  /** Honeypot field for bots; must remain empty. */
  website: z.string().max(0).optional().default(''),
});

export const demoRequestsListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: z.enum(DEMO_REQUEST_STATUSES as [string, ...string[]]).optional(),
  assignedTo: objectIdString.optional(),
  sortBy: z.enum(['createdAt', 'fullName', 'status', 'libraryName']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const demoRequestIdParamsSchema = z.object({
  requestId: objectIdString,
});

export const patchDemoRequestSchema = z
  .object({
    status: z.enum(DEMO_REQUEST_STATUSES as [string, ...string[]]).optional(),
    assignedTo: objectIdString.nullable().optional(),
    note: z.string().trim().min(1).max(4000).optional(),
    adminNote: z.string().trim().min(1).max(4000).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required',
  });

export type CreateDemoRequestInput = z.infer<typeof createDemoRequestSchema>;
export type DemoRequestsListQuery = z.infer<typeof demoRequestsListQuerySchema>;
export type PatchDemoRequestInput = z.infer<typeof patchDemoRequestSchema>;
