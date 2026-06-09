'use client';

import { useCallback, useRef, useState } from 'react';
import { FileText, Loader2, Upload, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { MediaAsset } from '@/lib/media-url';
import { isPdfAsset, mediaUrlFromField } from '@/lib/media-url';
import { uploadApi } from '@/modules/uploads/upload.service';

export function DocumentUploadField({
  label = 'Document proof',
  value,
  onChange,
  disabled,
}: {
  label?: string;
  value: MediaAsset | null;
  onChange: (asset: MediaAsset | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const previewUrl = mediaUrlFromField(value);
  const isPdf = isPdfAsset(value);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file || disabled) return;
      setError(null);
      setUploading(true);
      setFileName(file.name);
      try {
        const asset = await uploadApi.studentDocument(file, {
          previousPublicId: value?.publicId || undefined,
        });
        onChange(asset);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
        setFileName(null);
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [disabled, onChange, value?.publicId],
  );

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div
        className={cn(
          'rounded-xl border-2 border-dashed p-4',
          disabled && 'pointer-events-none opacity-60',
        )}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Uploading…
          </div>
        ) : value ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {isPdf ? (
              <div className="flex h-20 w-20 items-center justify-center rounded-lg border bg-muted">
                <FileText className="h-10 w-10 text-muted-foreground" />
              </div>
            ) : previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="" className="h-20 w-20 rounded-lg border object-cover" />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{fileName ?? 'Uploaded document'}</p>
              {previewUrl ? (
                <a href={previewUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                  {isPdf ? 'Open PDF' : 'Preview'}
                </a>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
                Replace
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  onChange(null);
                  setFileName(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <p className="text-sm text-muted-foreground">Aadhaar or ID proof · JPG, PNG, WEBP, or PDF · max 5MB</p>
            <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Upload document
            </Button>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          disabled={disabled || uploading}
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
