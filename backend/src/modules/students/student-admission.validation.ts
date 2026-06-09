import { z } from 'zod';
import { Types } from 'mongoose';

import { PAYMENT_METHODS } from '@modules/payments/payment.constants';
import { MEMBERSHIP_TYPE } from '@modules/membership/membership.constants';
import { createStudentBaseSchema } from './student.validation';

const objectIdString = z
  .string()
  .trim()
  .refine((id) => Types.ObjectId.isValid(id), { message: 'Invalid ObjectId' });

export const admissionMembershipSchema = z
  .object({
    enabled: z.coerce.boolean(),
    shiftId: objectIdString,
    feePlanId: objectIdString,
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(),
    membershipType: z.enum(Object.values(MEMBERSHIP_TYPE) as [string, ...string[]]).optional(),
    amountOverride: z.coerce.number().nonnegative().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.enabled) return;
    if (!v.shiftId) {
      ctx.addIssue({ code: 'custom', message: 'Shift is required', path: ['shiftId'] });
    }
    if (!v.feePlanId) {
      ctx.addIssue({ code: 'custom', message: 'Fee plan is required', path: ['feePlanId'] });
    }
  });

export const admissionSeatSchema = z
  .object({
    enabled: z.coerce.boolean(),
    seatId: objectIdString,
    shiftId: objectIdString,
  })
  .superRefine((v, ctx) => {
    if (!v.enabled) return;
    if (!v.seatId) ctx.addIssue({ code: 'custom', message: 'Seat is required', path: ['seatId'] });
    if (!v.shiftId) ctx.addIssue({ code: 'custom', message: 'Shift is required', path: ['shiftId'] });
  });

export const admissionPaymentSchema = z
  .object({
    enabled: z.coerce.boolean(),
    paidAmount: z.coerce.number().nonnegative().optional().default(0),
    method: z.enum(PAYMENT_METHODS).optional(),
    transactionId: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(2000).optional(),
    dueDate: z.coerce.date().optional(),
    discountAmount: z.coerce.number().nonnegative().optional().default(0),
    taxAmount: z.coerce.number().nonnegative().optional().default(0),
  })
  .superRefine((v, ctx) => {
    if (!v.enabled) return;
    if ((v.paidAmount ?? 0) > 0 && !v.method) {
      ctx.addIssue({ code: 'custom', message: 'Payment method is required', path: ['method'] });
    }
  });

export const studentAdmissionBodySchema = createStudentBaseSchema
  .omit({
    admissionDate: true,
    membershipStartDate: true,
    membershipEndDate: true,
    assignedSeatId: true,
    shiftId: true,
  })
  .extend({
    admissionDate: z.coerce.date().optional(),
    membership: admissionMembershipSchema.optional(),
    seatAssignment: admissionSeatSchema.optional(),
    payment: admissionPaymentSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.createLoginAccount && !v.temporaryPassword) {
      ctx.addIssue({
        code: 'custom',
        message: 'temporaryPassword is required when createLoginAccount is true',
        path: ['temporaryPassword'],
      });
    }
  });

export type StudentAdmissionInput = z.infer<typeof studentAdmissionBodySchema>;
