export interface MediaAsset {
  url: string;
  publicId: string;
  fileType?: string;
  uploadedAt?: string;
}

/** Resolve Cloudinary URL or legacy string photo fields. */
export function mediaUrlFromField(field: string | MediaAsset | null | undefined): string | undefined {
  if (!field) return undefined;
  if (typeof field === 'string') return field || undefined;
  return field.url || undefined;
}

export function mediaAssetFromField(field: string | MediaAsset | null | undefined): MediaAsset | null {
  if (!field) return null;
  if (typeof field === 'object' && field.publicId && field.url) {
    return field;
  }
  if (typeof field === 'string' && field.trim()) {
    return { url: field.trim(), publicId: '' };
  }
  return null;
}

export function isPdfAsset(asset: MediaAsset | null | undefined): boolean {
  if (!asset?.fileType) return false;
  return asset.fileType === 'application/pdf';
}
