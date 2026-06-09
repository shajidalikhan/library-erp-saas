import { z } from 'zod';

export const mediaAssetSchemaZod = z.object({
  url: z.string().trim().url('Invalid media URL').max(2048),
  publicId: z.string().trim().min(1).max(256),
  uploadedAt: z.coerce.date().optional(),
});

export const optionalMediaAssetSchemaZod = z
  .union([mediaAssetSchemaZod, z.null(), z.literal('').transform(() => null)])
  .optional();

/** Accepts Cloudinary asset from upload API or legacy URL string (read-only migration). */
export const logoFieldSchemaZod = z
  .union([
    mediaAssetSchemaZod,
    z.string().trim().url().max(2048),
    z.null(),
    z.literal('').transform(() => null),
  ])
  .optional();

export type MediaAssetInput = z.infer<typeof mediaAssetSchemaZod>;
