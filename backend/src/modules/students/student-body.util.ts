import type { Request } from 'express';

/** Multer file field names — never validate these as JSON body fields. */
const MULTIPART_FILE_FIELDS = new Set(['profilePhoto', 'documentProof']);

/** Coerce multipart text fields into create/update student body shape. */
export function parseStudentMultipartBody(req: Request): Record<string, unknown> {
  const raw = req.body as Record<string, string | undefined>;
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (MULTIPART_FILE_FIELDS.has(key)) continue;
    if (value === undefined || value === '') continue;
    if (value === 'null') {
      out[key] = null;
      continue;
    }
    if (value === 'true') {
      out[key] = true;
      continue;
    }
    if (value === 'false') {
      out[key] = false;
      continue;
    }
    if ((key === 'profilePhoto' || key === 'documentProof') && value.startsWith('{')) {
      try {
        out[key] = JSON.parse(value) as unknown;
        continue;
      } catch {
        /* fall through */
      }
    }
    out[key] = value;
  }

  return out;
}

export function getStudentUploadFiles(req: Request): {
  profilePhoto?: Express.Multer.File;
  documentProof?: Express.Multer.File;
} {
  const files = req.files as
    | { profilePhoto?: Express.Multer.File[]; documentProof?: Express.Multer.File[] }
    | undefined;
  return {
    profilePhoto: files?.profilePhoto?.[0],
    documentProof: files?.documentProof?.[0],
  };
}
