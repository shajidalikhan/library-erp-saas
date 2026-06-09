import { z } from 'zod';
import { Types } from 'mongoose';

const objectIdString = z
  .string()
  .trim()
  .refine((id) => Types.ObjectId.isValid(id), { message: 'Invalid ObjectId' });

export const uploadPreviousPublicIdSchema = z.object({
  previousPublicId: z.string().trim().max(256).optional(),
});

export const uploadLibraryLogoQuerySchema = z.object({
  libraryId: objectIdString.optional(),
});

export const uploadPublicLibraryPhotoQuerySchema = z.object({
  libraryId: objectIdString.optional(),
});

export type UploadPreviousPublicIdInput = z.infer<typeof uploadPreviousPublicIdSchema>;
