'use client';

import { useCallback, useRef, useState } from 'react';
import { ImagePlus, Loader2, Upload, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { MediaAsset } from '@/lib/media-url';
import { mediaUrlFromField } from '@/lib/media-url';

export interface ImageUploadFieldProps {
  id?: string;
  label?: string;
  description?: string;
  accept?: string;
  value: MediaAsset | null;
  onChange: (asset: MediaAsset | null) => void;
  onUpload: (file: File) => Promise<MediaAsset>;
  disabled?: boolean;
  className?: string;
  previewClassName?: string;
  aspect?: 'square' | 'wide';
}

export function ImageUploadField({
  id,
  label,
  description,
  accept = 'image/jpeg,image/png,image/webp',
  value,
  onChange,
  onUpload,
  disabled,
  className,
  previewClassName,
  aspect = 'square',
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const previewUrl = mediaUrlFromField(value);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file || disabled) return;
      setError(null);
      setUploading(true);
      try {
        const asset = await onUpload(file);
        onChange(asset);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [disabled, onChange, onUpload],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void handleFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div className={cn('space-y-2', className)}>
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
        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            Uploading…
          </div>
        ) : previewUrl ? (
          <div className="group relative w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt=""
              className={cn(
                'mx-auto rounded-lg border object-contain bg-white',
                aspect === 'square' ? 'h-28 w-28' : 'h-20 max-w-full',
                previewClassName,
              )}
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
                onClick={() => onChange(null)}
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
          accept={accept}
          className="sr-only"
          disabled={disabled || uploading}
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </div>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
