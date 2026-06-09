import { z } from 'zod';

const optionalPhone = z.string().trim().max(32).optional();

export const studentFormSchema = z.object({
  branchId: z.string().trim().min(1),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  createLoginAccount: z.boolean().optional().default(false),
  temporaryPassword: z.string().trim().min(8).max(128).optional().or(z.literal('')),
  phone: optionalPhone,
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED']).optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  pincode: z.string().trim().max(16).optional(),
  emergencyContactPhone: optionalPhone,
  guardianName: z.string().trim().max(120).optional(),
  guardianPhone: optionalPhone,
  aadhaarNumber: z.string().trim().max(20).optional(),
  admissionDate: z.string().optional(),
  membershipStartDate: z.string().optional(),
  membershipEndDate: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  notes: z.string().trim().max(5000).optional(),
}).superRefine((v, ctx) => {
  if (v.createLoginAccount && !v.temporaryPassword) {
    ctx.addIssue({
      code: 'custom',
      message: 'Temporary password is required when login account is enabled',
      path: ['temporaryPassword'],
    });
  }
});

export type StudentFormValues = z.infer<typeof studentFormSchema>;
