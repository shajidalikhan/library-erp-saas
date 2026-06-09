import { describe, expect, it } from 'vitest';

import { cloudinaryUrlForPdfEmbed } from './id-card-image.util';

describe('cloudinaryUrlForPdfEmbed', () => {
  it('inserts jpg transformation for cloudinary URLs', () => {
    const url =
      'https://res.cloudinary.com/demo/image/upload/v1/library_erp/students/photos/abc.webp';
    const out = cloudinaryUrlForPdfEmbed(url);
    expect(out).toContain('/upload/f_jpg,q_auto,w_800/');
  });

  it('leaves non-cloudinary URLs unchanged', () => {
    const url = 'https://example.com/photo.png';
    expect(cloudinaryUrlForPdfEmbed(url)).toBe(url);
  });
});
