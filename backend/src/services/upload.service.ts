import { Readable } from 'node:stream';

import type { UploadApiResponse } from 'cloudinary';
import sharp from 'sharp';

import { CLOUDINARY_CONFIGURED, cloudinary } from '@config/cloudinary';
import { ENV } from '@config/env.config';
import { ApiError } from '@utils/ApiError';
import { logger } from '@utils/logger';
import type { IDocumentProof, IMediaAsset } from '@utils/media-asset.schema';
import { mediaPublicIdFromField } from '@utils/media-asset.schema';

export const UPLOAD_NOT_CONFIGURED_MESSAGE = 'Cloudinary upload service is not configured.';

export type UploadFolder =
  | 'libraries'
  | 'branches'
  | 'students/photos'
  | 'students/documents'
  | 'public-pages';

const IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const DOCUMENT_MIMES = new Set([...IMAGE_MIMES, 'application/pdf']);
const BLOCKED_MIMES = new Set(['image/svg+xml', 'image/svg']);

const LOGO_MAX_WIDTH = 800;
const LOGO_QUALITY = 75;
const PROFILE_MAX_WIDTH = 800;
const PROFILE_QUALITY = 75;
const DOCUMENT_MAX_WIDTH = 1600;
const DOCUMENT_QUALITY = 75;
const PUBLIC_PAGE_MAX_WIDTH = 1400;
const PUBLIC_PAGE_QUALITY = 75;

export const UPLOAD_LIMITS = {
  profilePhotoBytes: 2 * 1024 * 1024,
  documentBytes: 5 * 1024 * 1024,
  logoBytes: 2 * 1024 * 1024,
  publicPagePhotoBytes: 3 * 1024 * 1024,
} as const;

const assertConfigured = (): void => {
  if (!CLOUDINARY_CONFIGURED) {
    throw ApiError.badRequest(UPLOAD_NOT_CONFIGURED_MESSAGE);
  }
};

const folderPath = (sub: UploadFolder): string => `${ENV.CLOUDINARY_UPLOAD_FOLDER}/${sub}`;

const extensionForMime = (mime: string): string | null => {
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'application/pdf') return 'pdf';
  return null;
};

export function validateImageUpload(
  file: Express.Multer.File,
  opts: { maxBytes: number; label: string; allowPdf?: boolean },
): void {
  const allowed = opts.allowPdf ? DOCUMENT_MIMES : IMAGE_MIMES;
  if (BLOCKED_MIMES.has(file.mimetype)) {
    throw ApiError.badRequest(`${opts.label}: SVG is not allowed`);
  }
  if (!allowed.has(file.mimetype)) {
    throw ApiError.badRequest(
      opts.allowPdf
        ? `${opts.label} must be JPG, PNG, WEBP, or PDF`
        : `${opts.label} must be JPG, PNG, or WEBP`,
    );
  }
  const ext = extensionForMime(file.mimetype);
  const originalExt = file.originalname.split('.').pop()?.toLowerCase();
  if (ext && originalExt && !['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(originalExt)) {
    throw ApiError.badRequest(`${opts.label}: unsupported file extension`);
  }
  if (file.size > opts.maxBytes) {
    const mb = Math.round(opts.maxBytes / (1024 * 1024));
    throw ApiError.badRequest(`${opts.label} must be ${mb}MB or smaller`);
  }
}

async function compressRasterImage(
  buffer: Buffer,
  opts: { maxWidth: number; quality: number },
): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize({ width: opts.maxWidth, withoutEnlargement: true })
    .webp({ quality: opts.quality })
    .toBuffer();
}

async function uploadBuffer(
  buffer: Buffer,
  subFolder: UploadFolder,
  options?: { resourceType?: 'image' | 'raw' | 'auto' },
): Promise<IMediaAsset & { uploadedAt: Date }> {
  assertConfigured();
  const resourceType = options?.resourceType ?? 'auto';

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: folderPath(subFolder),
        resource_type: resourceType,
      },
      (err, res) => {
        if (err || !res) reject(err ?? new Error('Upload failed'));
        else resolve(res);
      },
    );
    Readable.from(buffer).pipe(stream);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    uploadedAt: new Date(),
  };
}

async function uploadBufferToFolder(
  buffer: Buffer,
  folder: string,
  options?: { resourceType?: 'image' | 'raw' | 'auto' },
): Promise<IMediaAsset & { uploadedAt: Date }> {
  assertConfigured();
  const resourceType = options?.resourceType ?? 'auto';
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },
      (err, res) => {
        if (err || !res) reject(err ?? new Error('Upload failed'));
        else resolve(res);
      },
    );
    Readable.from(buffer).pipe(stream);
  });
  return {
    url: result.secure_url,
    publicId: result.public_id,
    uploadedAt: new Date(),
  };
}

export async function safeDeleteCloudinaryAsset(publicId: string | undefined | null): Promise<void> {
  if (!publicId || !CLOUDINARY_CONFIGURED) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    logger.warn('Cloudinary asset deletion failed', { publicId, err });
  }
}

export async function replaceCloudinaryAsset(
  previousPublicId: string | undefined | null,
  buffer: Buffer,
  subFolder: UploadFolder,
  options?: { resourceType?: 'image' | 'raw' | 'auto' },
): Promise<IMediaAsset & { uploadedAt: Date }> {
  const uploaded = await uploadBuffer(buffer, subFolder, options);
  if (previousPublicId && previousPublicId !== uploaded.publicId) {
    await safeDeleteCloudinaryAsset(previousPublicId);
  }
  return uploaded;
}

export async function uploadLibraryLogo(
  file: Express.Multer.File,
  previousPublicId?: string | null,
): Promise<IMediaAsset & { uploadedAt: Date }> {
  validateImageUpload(file, { maxBytes: UPLOAD_LIMITS.logoBytes, label: 'Library logo' });
  const buffer = await compressRasterImage(file.buffer, {
    maxWidth: LOGO_MAX_WIDTH,
    quality: LOGO_QUALITY,
  });
  return replaceCloudinaryAsset(previousPublicId, buffer, 'libraries', { resourceType: 'image' });
}

export async function uploadBranchLogo(
  file: Express.Multer.File,
  previousPublicId?: string | null,
): Promise<IMediaAsset & { uploadedAt: Date }> {
  validateImageUpload(file, { maxBytes: UPLOAD_LIMITS.logoBytes, label: 'Branch logo' });
  const buffer = await compressRasterImage(file.buffer, {
    maxWidth: LOGO_MAX_WIDTH,
    quality: LOGO_QUALITY,
  });
  return replaceCloudinaryAsset(previousPublicId, buffer, 'branches', { resourceType: 'image' });
}

export async function uploadPublicLibraryPhoto(
  file: Express.Multer.File,
  libraryId: string,
  previousPublicId?: string | null,
): Promise<IMediaAsset & { uploadedAt: Date }> {
  validateImageUpload(file, { maxBytes: UPLOAD_LIMITS.publicPagePhotoBytes, label: 'Public page photo' });
  const buffer = await compressRasterImage(file.buffer, {
    maxWidth: PUBLIC_PAGE_MAX_WIDTH,
    quality: PUBLIC_PAGE_QUALITY,
  });
  const uploaded = await uploadBufferToFolder(
    buffer,
    `${ENV.CLOUDINARY_UPLOAD_FOLDER}/public-pages/${libraryId}`,
    { resourceType: 'image' },
  );
  if (previousPublicId && previousPublicId !== uploaded.publicId) {
    await safeDeleteCloudinaryAsset(previousPublicId);
  }
  return uploaded;
}

export async function uploadStudentProfilePhoto(
  file: Express.Multer.File,
  previousPublicId?: string | null,
): Promise<IMediaAsset & { uploadedAt: Date }> {
  validateImageUpload(file, { maxBytes: UPLOAD_LIMITS.profilePhotoBytes, label: 'Profile photo' });
  const buffer = await compressRasterImage(file.buffer, {
    maxWidth: PROFILE_MAX_WIDTH,
    quality: PROFILE_QUALITY,
  });
  return replaceCloudinaryAsset(previousPublicId, buffer, 'students/photos', { resourceType: 'image' });
}

export async function uploadStudentDocument(
  file: Express.Multer.File,
  previousPublicId?: string | null,
): Promise<IDocumentProof & { uploadedAt: Date }> {
  validateImageUpload(file, {
    maxBytes: UPLOAD_LIMITS.documentBytes,
    label: 'Document',
    allowPdf: true,
  });

  const isPdf = file.mimetype === 'application/pdf';
  if (isPdf) {
    const asset = await replaceCloudinaryAsset(previousPublicId, file.buffer, 'students/documents', {
      resourceType: 'raw',
    });
    return { ...asset, fileType: file.mimetype };
  }

  const buffer = await compressRasterImage(file.buffer, {
    maxWidth: DOCUMENT_MAX_WIDTH,
    quality: DOCUMENT_QUALITY,
  });
  const asset = await replaceCloudinaryAsset(previousPublicId, buffer, 'students/documents', {
    resourceType: 'image',
  });
  return { ...asset, fileType: 'image/webp' };
}

/** Clears a stored media field and deletes the Cloudinary asset when possible. */
export async function clearStoredMedia(field: unknown): Promise<void> {
  await safeDeleteCloudinaryAsset(mediaPublicIdFromField(field));
}

/** Applies logo/media update: replaces asset metadata and deletes previous Cloudinary file. */
export async function applyMediaAssetUpdate(
  current: unknown,
  next: unknown | undefined,
): Promise<IMediaAsset | string | null | undefined> {
  if (next === undefined) return undefined;
  if (next === null || next === '') {
    await clearStoredMedia(current);
    return null;
  }
  if (typeof next === 'object' && next !== null && 'publicId' in next && 'url' in next) {
    const asset = next as IMediaAsset;
    const prevId = mediaPublicIdFromField(current);
    if (prevId && prevId !== asset.publicId) {
      await safeDeleteCloudinaryAsset(prevId);
    }
    return {
      url: asset.url,
      publicId: asset.publicId,
      uploadedAt: new Date(),
    };
  }
  if (typeof next === 'string') {
    return next;
  }
  throw ApiError.badRequest('Invalid media asset');
}

// Backward-compatible exports used by student-upload and legacy imports
export { uploadBuffer, replaceCloudinaryAsset as replaceAsset, safeDeleteCloudinaryAsset as deleteCloudinaryAsset };
