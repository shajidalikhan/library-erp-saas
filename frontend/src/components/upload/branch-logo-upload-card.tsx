'use client';

import type { MediaAsset } from '@/lib/media-url';
import { uploadApi } from '@/modules/uploads/upload.service';

import { ImageUploadField } from './image-upload-field';

export function BranchLogoUploadCard({
  value,
  onChange,
  disabled,
}: {
  value: MediaAsset | null;
  onChange: (asset: MediaAsset | null) => void;
  disabled?: boolean;
}) {
  return (
    <ImageUploadField
      label="Branch logo"
      description="JPG, PNG, or WEBP · max 2MB"
      value={value}
      onChange={onChange}
      disabled={disabled}
      onUpload={async (file) =>
        uploadApi.branchLogo(file, { previousPublicId: value?.publicId || undefined })
      }
    />
  );
}
