import {
  uploadStudentDocument,
  uploadStudentProfilePhoto,
} from '@/services/upload.service';
import type { IDocumentProof, IMediaAsset } from '@utils/media-asset.schema';

export async function processProfilePhotoUpload(
  file: Express.Multer.File,
  previousPublicId?: string | null,
): Promise<IMediaAsset> {
  return uploadStudentProfilePhoto(file, previousPublicId);
}

export async function processDocumentProofUpload(
  file: Express.Multer.File,
  previousPublicId?: string | null,
): Promise<IDocumentProof> {
  return uploadStudentDocument(file, previousPublicId);
}
