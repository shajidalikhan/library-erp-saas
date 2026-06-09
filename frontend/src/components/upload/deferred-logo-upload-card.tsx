'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Upload, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { MediaAsset } from '@/lib/media-url';
import { mediaUrlFromField } from '@/lib/media-url';

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp';

function validateDeferredLogo(file: File): string | null {
  const okMime = /^image\/(jpeg|jpg|png|webp)$/i.test(file.type);
  if (!okMime) return 'Use JPG, PNG, or WEBP';
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext && !['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return 'Unsupported file extension';
  }
  if (file.size > MAX_BYTES) return 'Logo must be 2MB or smaller';
  return null;
}

export interface DeferredLogoUploadCardProps {
  id?: string;
  label?: string;
  /** Existing logo from API (shown when nothing selected locally). */
  remoteAsset: MediaAsset | null;
  pendingFile: File | null;
  onPendingFileChange: (file: File | null) => void;
  /** True once user clears the remote logo (submit sends logo: null without a new file). */
  clearedRemoteLogo: boolean;
  onClearRemoteLogoChange: (cleared: boolean) => void;
  disabled?: boolean;
}

export function DeferredLogoUploadCard({
  id,
  label = 'Logo',
  remoteAsset,
  pendingFile,
  onPendingFileChange,
  clearedRemoteLogo,
  onClearRemoteLogoChange,
  disabled,
}: DeferredLogoUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingFile) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const remoteUrl = clearedRemoteLogo ? null : mediaUrlFromField(remoteAsset);
  const previewUrl = objectUrl ?? remoteUrl;

  const consumeFile = useCallback(
    (file: File | undefined) => {
      if (!file || disabled) return;
      const msg = validateDeferredLogo(file);
      if (msg) {
        setError(msg);
        return;
      }
      setError(null);
      onClearRemoteLogoChange(false);
      onPendingFileChange(file);
    },
    [disabled, onPendingFileChange, onClearRemoteLogoChange],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      consumeFile(e.dataTransfer.files?.[0]);
    },
    [consumeFile],
  );

  const resetInput = (): void => {
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2 sm:col-span-2">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <div
        className={cn(
          'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
          disabled && 'pointer-events-none opacity-60',
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {previewUrl ? (
          <div className="group relative w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt=""
              className="mx-auto h-28 w-28 rounded-lg border object-contain bg-white"
            />
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
                Replace
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => {
                  if (pendingFile) {
                    onPendingFileChange(null);
                    resetInput();
                  } else {
                    onClearRemoteLogoChange(true);
                  }
                  setError(null);
                }}
              >
                <X className="mr-1 h-3 w-3" />
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <ImagePlus className="h-10 w-10 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">Drag and drop or choose an image</p>
            <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Choose file
            </Button>
          </div>
        )}
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            consumeFile(e.target.files?.[0]);
            resetInput();
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        JPG, PNG, or WEBP · max 2MB · uploads when you save the library
      </p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
