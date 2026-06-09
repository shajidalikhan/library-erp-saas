import { z } from 'zod';

import { DEMO_REQUEST_FEATURES } from './demo-request.constants';

const featureIds = DEMO_REQUEST_FEATURES.map((f) => f.id) as [string, ...string[]];

export const requestDemoSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone: z
    .string()
    .trim()
    .min(8, 'Enter a valid phone number')
    .max(20)
    .regex(/^[+]?[\d\s()-]{8,20}$/, 'Enter a valid phone number'),
  libraryName: z.string().trim().min(2, 'Enter your library name').max(160),
  city: z.string().trim().min(2, 'Enter your city').max(120),
  branchCount: z.number().int().min(1, 'At least one branch').max(500),
  studentCount: z.number().int().min(1, 'Enter approximate students').max(1_000_000),
  currentSystem: z.string().trim().max(160),
  interestedFeatures: z.array(z.enum(featureIds)),
  notes: z.string().trim().max(4000),
  website: z.string().max(0),
});

export type RequestDemoFormValues = z.infer<typeof requestDemoSchema>;
