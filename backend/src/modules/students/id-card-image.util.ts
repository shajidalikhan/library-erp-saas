import sharp from 'sharp';

/** Cloudinary delivery URL suitable for PDF embedding (JPEG). */
export function cloudinaryUrlForPdfEmbed(url: string): string {
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) {
    return url;
  }
  if (/\/upload\/[^/]*f_/.test(url)) {
    return url;
  }
  return url.replace('/upload/', '/upload/f_jpg,q_auto,w_800/');
}

const isWebpBuffer = (buf: Buffer): boolean =>
  buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46;

/** Fetch raster image and normalize to JPEG for PDFKit. */
export async function fetchImageBufferForPdf(url: string): Promise<Buffer | null> {
  const deliveryUrl = cloudinaryUrlForPdfEmbed(url);
  try {
    const res = await fetch(deliveryUrl);
    if (!res.ok) return null;
    const raw = Buffer.from(await res.arrayBuffer());
    if (!raw.length) return null;
    if (isWebpBuffer(raw) || deliveryUrl.includes('.webp') || deliveryUrl.includes('f_webp')) {
      return sharp(raw).jpeg({ quality: 85 }).toBuffer();
    }
    try {
      return await sharp(raw).jpeg({ quality: 85 }).toBuffer();
    } catch {
      return raw;
    }
  } catch {
    return null;
  }
}
