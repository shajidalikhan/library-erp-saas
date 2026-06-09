import { clearStoredMedia, safeDeleteCloudinaryAsset } from '@/services/upload.service';
import { mediaPublicIdFromField } from '@utils/media-asset.schema';

/** Deletes Cloudinary assets for a student profile and document proof. */
export async function deleteStudentMedia(student: {
  profilePhoto?: unknown;
  documentProof?: unknown;
}): Promise<void> {
  await clearStoredMedia(student.profilePhoto);
  await clearStoredMedia(student.documentProof);
}

/** Deletes branch logo from Cloudinary. */
export async function deleteBranchMedia(branch: { logo?: unknown }): Promise<void> {
  await clearStoredMedia(branch.logo);
}

/** Deletes library logo from Cloudinary. */
export async function deleteLibraryMedia(library: { logo?: unknown }): Promise<void> {
  await clearStoredMedia(library.logo);
}

/** Best-effort delete for a list of public IDs (e.g. batch student cleanup). */
export async function deletePublicIds(publicIds: (string | null | undefined)[]): Promise<void> {
  const unique = [...new Set(publicIds.map((id) => mediaPublicIdFromField(id)).filter(Boolean))] as string[];
  await Promise.all(unique.map((id) => safeDeleteCloudinaryAsset(id)));
}
