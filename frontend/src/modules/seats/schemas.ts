import { z } from 'zod';

export const seatTypes = ['STANDARD', 'PREMIUM', 'CABIN', 'SILENT_ZONE'] as const;
export const seatStatuses = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE', 'BLOCKED'] as const;

export const seatCreateFormSchema = z.object({
  libraryId: z.string().min(1, 'Library required'),
  branchId: z.string().min(1, 'Branch required'),
  seatNumber: z.string().trim().min(1).max(40),
  floor: z.string().trim().min(1).max(40).default('1'),
  zone: z.string().trim().min(1).max(80).default('General'),
  seatType: z.enum(seatTypes).default('STANDARD'),
  notes: z.string().max(500).optional().or(z.literal('')),
  status: z.enum(seatStatuses).default('AVAILABLE'),
  active: z.boolean().default(true),
});

export const seatEditFormSchema = z.object({
  seatNumber: z.string().trim().min(1).max(40),
  floor: z.string().trim().min(1).max(40),
  zone: z.string().trim().min(1).max(80),
  seatType: z.enum(seatTypes),
  notes: z.string().max(500).optional().or(z.literal('')),
  status: z.enum(seatStatuses),
  active: z.boolean(),
  reservedUntil: z.string().optional().or(z.literal('')),
});

export const bulkSeatFormSchema = z
  .object({
    libraryId: z.string().min(1),
    branchId: z.string().min(1),
    prefix: z.string().max(10).optional().default(''),
    startNumber: z.coerce.number().int().min(1),
    endNumber: z.coerce.number().int().min(1),
    floor: z.string().min(1),
    zone: z.string().min(1),
    seatType: z.enum(seatTypes),
    padLength: z.coerce.number().int().min(0).max(6).default(0),
  })
  .superRefine((d, ctx) => {
    if (d.endNumber < d.startNumber) {
      ctx.addIssue({ code: 'custom', path: ['endNumber'], message: 'End must be ≥ start' });
    }
  });

export type SeatCreateFormValues = z.infer<typeof seatCreateFormSchema>;
export type SeatEditFormValues = z.infer<typeof seatEditFormSchema>;
export type BulkSeatFormValues = z.infer<typeof bulkSeatFormSchema>;
