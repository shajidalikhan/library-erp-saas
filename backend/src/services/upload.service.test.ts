import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@utils/ApiError';

import {
  UPLOAD_NOT_CONFIGURED_MESSAGE,
  UPLOAD_LIMITS,
  validateImageUpload,
} from './upload.service';

vi.mock('@config/cloudinary', () => ({
  CLOUDINARY_CONFIGURED: false,
  cloudinary: { uploader: { upload_stream: vi.fn(), destroy: vi.fn() } },
}));

describe('upload.service', () => {
  const imageFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File =>
    ({
      fieldname: 'file',
      originalname: 'photo.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from('fake'),
      ...overrides,
    }) as Express.Multer.File;

  it('rejects unsupported mime types', () => {
    expect(() =>
      validateImageUpload(imageFile({ mimetype: 'application/x-msdownload' }), {
        maxBytes: UPLOAD_LIMITS.logoBytes,
        label: 'Logo',
      }),
    ).toThrow(ApiError);
  });

  it('rejects oversize files', () => {
    expect(() =>
      validateImageUpload(imageFile({ size: UPLOAD_LIMITS.profilePhotoBytes + 1 }), {
        maxBytes: UPLOAD_LIMITS.profilePhotoBytes,
        label: 'Profile photo',
      }),
    ).toThrow(/2MB/);
  });

  it('rejects SVG', () => {
    expect(() =>
      validateImageUpload(imageFile({ mimetype: 'image/svg+xml' }), {
        maxBytes: UPLOAD_LIMITS.logoBytes,
        label: 'Logo',
      }),
    ).toThrow(/SVG/);
  });

  it('exposes not-configured message constant', () => {
    expect(UPLOAD_NOT_CONFIGURED_MESSAGE).toContain('Cloudinary upload service is not configured');
  });

  it('uploadBuffer fails when cloudinary is not configured', async () => {
    const { uploadBuffer } = await import('./upload.service');
    await expect(uploadBuffer(Buffer.from('test'), 'libraries')).rejects.toThrow(
      UPLOAD_NOT_CONFIGURED_MESSAGE,
    );
  });
});
