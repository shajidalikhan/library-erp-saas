import { Schema } from 'mongoose';

export interface IMediaAsset {
  url: string;
  publicId: string;
  uploadedAt?: Date;
}

export const mediaAssetSchema = new Schema<IMediaAsset>(
  {
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    publicId: { type: String, required: true, trim: true, maxlength: 256 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

export interface IDocumentProof extends IMediaAsset {
  fileType?: string;
  /** @deprecated use fileType */
  type?: string;
}

export const documentProofSchema = new Schema<IDocumentProof>(
  {
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    publicId: { type: String, required: true, trim: true, maxlength: 256 },
    fileType: { type: String, trim: true, maxlength: 64 },
    type: { type: String, trim: true, maxlength: 64 },
  },
  { _id: false },
);

export const mediaUrlFromField = (field: unknown): string | null => {
  if (!field) return null;
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && field !== null && 'url' in field) {
    return String((field as IMediaAsset).url);
  }
  return null;
};

export const mediaPublicIdFromField = (field: unknown): string | null => {
  if (!field || typeof field !== 'object' || !('publicId' in field)) return null;
  const id = (field as IMediaAsset).publicId;
  return id ? String(id) : null;
};
