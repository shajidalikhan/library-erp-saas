'use client';

import type { MediaAsset } from '@/lib/media-url';
import { uploadApi } from '@/modules/uploads/upload.service';

import { DeferredLogoUploadCard } from './deferred-logo-upload-card';
import { ImageUploadField } from './image-upload-field';

export type LogoUploadStrategy = 'upload-now' | 'save-with-library';

/** Upload now (Cloudinary) — branches, inline edits. Save with library — multipart on library create/update. */
export interface LogoUploadCardProps {
  label?: string;
  strategy?: LogoUploadStrategy;
  /** upload-now: controlled asset */
  value?: MediaAsset | null;
  onChange?: (asset: MediaAsset | null) => void;
  /** save-with-library */
  remoteAsset?: MediaAsset | null;
  pendingFile?: File | null;
  onPendingFileChange?: (file: File | null) => void;
  clearedRemoteLogo?: boolean;
  onClearRemoteLogoChange?: (cleared: boolean) => void;

  libraryId?: string;
  disabled?: boolean;
  error?: string;
}

export function LogoUploadCard({
  label = 'Logo',
  strategy = 'upload-now',
  value = null,
  onChange,
  remoteAsset = null,
  pendingFile = null,
  onPendingFileChange,
  clearedRemoteLogo = false,
  onClearRemoteLogoChange,
  libraryId,
  disabled,
  error,
}: LogoUploadCardProps) {
  if (strategy === 'save-with-library') {
    const onPending = onPendingFileChange ?? (() => undefined);
    const onClearRemote = onClearRemoteLogoChange ?? (() => undefined);
    return (
      <>
        <DeferredLogoUploadCard
          label={label}
          disabled={disabled}
          remoteAsset={remoteAsset}
          pendingFile={pendingFile}
          onPendingFileChange={onPending}
          clearedRemoteLogo={clearedRemoteLogo}
          onClearRemoteLogoChange={onClearRemote}
        />
        {error ? <p className="text-xs text-destructive sm:col-span-2">{error}</p> : null}
      </>
    );
  }

  const setAsset = onChange ?? (() => undefined);
  return (
    <>
      <ImageUploadField
        label={label}
        description="JPG, PNG, or WEBP · max 2MB · compressed automatically"
        value={value}
        onChange={setAsset}
        disabled={disabled}
        onUpload={async (file) =>
          uploadApi.libraryLogo(file, {
            previousPublicId: value?.publicId || undefined,
            libraryId,
          })
        }
        aspect="square"
      />
      {error ? <p className="text-xs text-destructive sm:col-span-2">{error}</p> : null}
    </>
  );
}
