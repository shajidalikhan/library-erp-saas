import { request } from '@/lib/axios';
import type { MediaAsset } from '@/lib/media-url';

export type UploadedMedia = MediaAsset & { uploadedAt?: string };

async function postUpload(
  path: string,
  file: File,
  opts?: { previousPublicId?: string; libraryId?: string },
): Promise<UploadedMedia> {
  const form = new FormData();
  form.append('file', file);
  if (opts?.previousPublicId) form.append('previousPublicId', opts.previousPublicId);
  return request<UploadedMedia>({
    url: path,
    method: 'POST',
    data: form,
    params: opts?.libraryId ? { libraryId: opts.libraryId } : undefined,
  });
}

export const uploadApi = {
  libraryLogo: (file: File, opts?: { previousPublicId?: string; libraryId?: string }) =>
    postUpload('/uploads/library-logo', file, opts),

  branchLogo: (file: File, opts?: { previousPublicId?: string }) =>
    postUpload('/uploads/branch-logo', file, opts),

  studentPhoto: (file: File, opts?: { previousPublicId?: string }) =>
    postUpload('/uploads/student-photo', file, opts),

  studentDocument: (file: File, opts?: { previousPublicId?: string }) =>
    postUpload('/uploads/student-document', file, opts),

  publicLibraryPhoto: (file: File, opts?: { previousPublicId?: string; libraryId?: string }) =>
    postUpload('/uploads/public-library-photo', file, opts),
};
