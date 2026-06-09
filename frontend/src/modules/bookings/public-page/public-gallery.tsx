'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Expand } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { PublicPhoto } from './utils';
import { getCoverPhoto, sortPublicPhotos } from './utils';

type PublicGalleryProps = {
  photos: PublicPhoto[];
  libraryName: string;
};

export function PublicGallery({ photos, libraryName }: PublicGalleryProps) {
  const sorted = sortPublicPhotos(photos);
  const cover = getCoverPhoto(sorted);
  const thumbs = sorted.filter((p) => p.url !== cover?.url).slice(0, 4);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!sorted.length) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Gallery</h2>
        <div className="flex h-48 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 via-violet-50 to-slate-100 dark:from-indigo-950/40 dark:via-violet-950/30 dark:to-slate-900">
          <p className="text-sm text-muted-foreground">Photos coming soon</p>
        </div>
      </section>
    );
  }

  const openAt = (index: number) => setLightboxIndex(index);
  const allForLightbox = sorted;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">Gallery</h2>
      <div className="grid gap-2 md:grid-cols-4 md:grid-rows-2">
        <button
          type="button"
          onClick={() => openAt(sorted.findIndex((p) => p.url === cover?.url) || 0)}
          className="group relative col-span-2 row-span-2 min-h-[220px] overflow-hidden rounded-2xl md:min-h-[280px]"
        >
          <Image
            src={cover!.url}
            alt={cover?.caption || `${libraryName} cover`}
            fill
            className="object-cover transition duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 50vw"
            unoptimized
          />
          <span className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white opacity-0 transition group-hover:opacity-100">
            <Expand className="h-4 w-4" />
          </span>
        </button>
        {thumbs.map((photo, idx) => (
          <button
            key={photo.publicId || photo.url}
            type="button"
            onClick={() => openAt(sorted.findIndex((p) => p.url === photo.url))}
            className="group relative min-h-[100px] overflow-hidden rounded-xl md:min-h-0"
          >
            <Image
              src={photo.url}
              alt={photo.caption || `Gallery ${idx + 1}`}
              fill
              className="object-cover transition duration-300 group-hover:scale-105"
              sizes="25vw"
              unoptimized
            />
          </button>
        ))}
      </div>

      <Dialog open={lightboxIndex !== null} onOpenChange={(open) => !open && setLightboxIndex(null)}>
        <DialogContent className="max-w-4xl border-0 bg-black/95 p-2 sm:p-4">
          <DialogTitle className="sr-only">Photo gallery</DialogTitle>
          {lightboxIndex !== null ? (
            <div className="space-y-3">
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg">
                <Image
                  src={allForLightbox[lightboxIndex].url}
                  alt={allForLightbox[lightboxIndex].caption || libraryName}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
              {allForLightbox[lightboxIndex].caption ? (
                <p className="text-center text-sm text-white/80">{allForLightbox[lightboxIndex].caption}</p>
              ) : null}
              <div className="flex justify-center gap-2 overflow-x-auto pb-1">
                {allForLightbox.map((photo, i) => (
                  <button
                    key={photo.publicId || photo.url}
                    type="button"
                    onClick={() => setLightboxIndex(i)}
                    className={cn(
                      'relative h-14 w-20 shrink-0 overflow-hidden rounded-md border-2',
                      i === lightboxIndex ? 'border-white' : 'border-transparent opacity-60',
                    )}
                  >
                    <Image src={photo.url} alt="" fill className="object-cover" unoptimized />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
