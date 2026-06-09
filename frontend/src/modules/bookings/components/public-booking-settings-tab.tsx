'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, ImagePlus, Link2, MapPin, Save } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/use-permissions';
import { useTenantScope } from '@/hooks/use-tenant-scope';
import { AMENITY_CATALOG } from '@/modules/bookings/public-page/amenity-catalog';
import { libraryApi } from '@/modules/library/library.service';
import { libraryQueryKeys } from '@/modules/library/library-query-keys';
import { uploadApi } from '@/modules/uploads/upload.service';
import { cn } from '@/lib/utils';

type PublicPhoto = {
  url: string;
  publicId: string;
  caption?: string;
  isCover: boolean;
  order: number;
};

type PublicSettingsState = {
  publicPageEnabled: boolean;
  publicSlug: string;
  publicDescription: string;
  mapLocation: string;
  latitude: string;
  longitude: string;
  showPhone: boolean;
  showEmail: boolean;
  showWhatsApp: boolean;
  bookingEnabled: boolean;
  showFullSeatBreakdown: boolean;
  holdHours: string;
  publicPhotos: PublicPhoto[];
  amenities: string[];
  rulesText: string;
};

const defaults: PublicSettingsState = {
  publicPageEnabled: true,
  publicSlug: '',
  publicDescription: '',
  mapLocation: '',
  latitude: '',
  longitude: '',
  showPhone: true,
  showEmail: false,
  showWhatsApp: false,
  bookingEnabled: true,
  showFullSeatBreakdown: false,
  holdHours: '3',
  publicPhotos: [],
  amenities: [],
  rulesText: '',
};

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function PublicBookingSettingsTab() {
  const { canAny } = usePermissions();
  const { effectiveLibraryId } = useTenantScope();
  const libraryId = effectiveLibraryId || undefined;
  const canManagePublicPage = canAny([PERMISSIONS.PUBLIC_PAGE_MANAGE, PERMISSIONS.LIBRARY_UPDATE]);
  const qc = useQueryClient();
  const { data: library } = useQuery({
    queryKey: libraryQueryKeys.library(libraryId ?? ''),
    queryFn: () => libraryApi.getLibrary(libraryId!),
    enabled: Boolean(libraryId && canManagePublicPage),
  });
  const [uploading, setUploading] = useState(false);

  const initial = useMemo(() => {
    const raw = ((library?.settings as Record<string, unknown> | undefined)?.publicBookingPage ??
      {}) as Record<string, unknown>;
    const normalizedPhotos: PublicPhoto[] = [];
    if (Array.isArray(raw.publicPhotos)) {
      raw.publicPhotos.forEach((item, index) => {
        if (!item || typeof item !== 'object') return;
        const row = item as Record<string, unknown>;
        if (typeof row.url !== 'string' || typeof row.publicId !== 'string') return;
        normalizedPhotos.push({
          url: row.url,
          publicId: row.publicId,
          caption: typeof row.caption === 'string' ? row.caption : '',
          isCover: Boolean(row.isCover),
          order: typeof row.order === 'number' ? row.order : index,
        });
      });
      normalizedPhotos.sort((a, b) => a.order - b.order);
    }
    if (normalizedPhotos.length && !normalizedPhotos.some((photo) => photo.isCover)) {
      normalizedPhotos[0].isCover = true;
    }
    return {
      ...defaults,
      publicPageEnabled: raw.publicPageEnabled !== false,
      publicSlug: String(raw.publicSlug ?? library?.slug ?? ''),
      publicDescription: String(raw.publicDescription ?? ''),
      mapLocation: String(raw.mapLocation ?? ''),
      latitude: raw.latitude ? String(raw.latitude) : '',
      longitude: raw.longitude ? String(raw.longitude) : '',
      showPhone: raw.showPhone !== false,
      showEmail: Boolean(raw.showEmail),
      showWhatsApp: Boolean(raw.showWhatsApp),
      bookingEnabled: raw.bookingEnabled !== false,
      showFullSeatBreakdown: Boolean(raw.showFullSeatBreakdown),
      holdHours: String(raw.holdHours ?? 3),
      publicPhotos: normalizedPhotos,
      amenities: Array.isArray(raw.amenities) ? raw.amenities.map((v) => String(v)) : [],
      rulesText: Array.isArray(raw.rules) ? raw.rules.join('\n') : '',
    };
  }, [library?.settings, library?.slug]);

  const [state, setState] = useState<PublicSettingsState>(defaults);
  useEffect(() => {
    setState(initial);
  }, [initial]);

  if (!canManagePublicPage) {
    return <EmptyState title="Access denied" description="You do not have permission to manage the public page." />;
  }

  if (!libraryId || !library) {
    return <EmptyState title="No library selected" description="Select a library workspace first." />;
  }

  const publicUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/l/${state.publicSlug || library.slug}`
      : `/l/${state.publicSlug || library.slug}`;

  const toggleAmenity = (label: string) => {
    setState((prev) => {
      const has = prev.amenities.some((a) => a.toLowerCase() === label.toLowerCase());
      return {
        ...prev,
        amenities: has ? prev.amenities.filter((a) => a.toLowerCase() !== label.toLowerCase()) : [...prev.amenities, label],
      };
    });
  };

  const saveSettings = async () => {
    const settings = {
      ...(library.settings as Record<string, unknown>),
      publicBookingPage: {
        publicPageEnabled: state.publicPageEnabled,
        publicSlug: state.publicSlug,
        publicDescription: state.publicDescription,
        mapLocation: state.mapLocation,
        latitude: state.latitude ? Number(state.latitude) : undefined,
        longitude: state.longitude ? Number(state.longitude) : undefined,
        showPhone: state.showPhone,
        showEmail: state.showEmail,
        showWhatsApp: state.showWhatsApp,
        bookingEnabled: state.bookingEnabled,
        showFullSeatBreakdown: state.showFullSeatBreakdown,
        holdHours: Number(state.holdHours || '3'),
        publicPhotos: state.publicPhotos.map((photo, index) => ({
          url: photo.url,
          publicId: photo.publicId,
          caption: photo.caption?.trim() || undefined,
          isCover: photo.isCover,
          order: index,
        })),
        amenities: state.amenities,
        rules: state.rulesText
          .split('\n')
          .map((v) => v.trim())
          .filter(Boolean),
      },
    };
    await libraryApi.patchLibrarySettings(libraryId, settings);
    toast.success('Public booking settings saved');
    void qc.invalidateQueries({ queryKey: libraryQueryKeys.library(libraryId) });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5" />
            Public page & link
          </CardTitle>
          <CardDescription>Share this URL on Google Maps, WhatsApp, Instagram, or your website.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="publicSlug">Public slug</Label>
              <Input
                id="publicSlug"
                value={state.publicSlug}
                onChange={(e) => setState((prev) => ({ ...prev, publicSlug: e.target.value.toLowerCase() }))}
                placeholder="my-library"
              />
            </div>
            <div className="space-y-2">
              <Label>Live preview</Label>
              <Button asChild variant="outline" className="w-full justify-start">
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open public page
                </a>
              </Button>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-medium text-muted-foreground">Public URL</p>
            <p className="mt-1 break-all text-sm font-mono">{publicUrl}</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(publicUrl);
                  toast.success('Public link copied');
                } catch {
                  toast.error('Could not copy link');
                }
              }}
            >
              Copy public link
            </Button>
          </div>
          <div className="flex flex-col items-center gap-3 rounded-lg border p-4 sm:flex-row">
            <img
              alt="QR code for public page"
              className="h-32 w-32 rounded-lg bg-white p-2 shadow-sm"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(publicUrl)}`}
            />
            <p className="text-sm text-muted-foreground">
              Print or share this QR at your library entrance so students can open your booking page instantly.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5" />
            Page content
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="publicDescription">Description / tagline</Label>
            <textarea
              id="publicDescription"
              className="flex min-h-[88px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              value={state.publicDescription}
              onChange={(e) => setState((prev) => ({ ...prev, publicDescription: e.target.value }))}
              placeholder="Quiet AC study hall with flexible shifts…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mapLocation">Google Maps link or embed URL</Label>
            <Input
              id="mapLocation"
              value={state.mapLocation}
              onChange={(e) => setState((prev) => ({ ...prev, mapLocation: e.target.value }))}
              placeholder="https://www.google.com/maps/embed?... or share link"
            />
            <p className="text-xs text-muted-foreground">
              Paste an embed URL for inline map, or a share link — visitors get an &quot;Open in Google Maps&quot; button.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude (optional)</Label>
              <Input
                id="latitude"
                value={state.latitude}
                onChange={(e) => setState((prev) => ({ ...prev, latitude: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude (optional)</Label>
              <Input
                id="longitude"
                value={state.longitude}
                onChange={(e) => setState((prev) => ({ ...prev, longitude: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ImagePlus className="h-5 w-5" />
            Photo gallery
          </CardTitle>
          <CardDescription>Upload photos (max 10). Set one as cover for the hero background.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            className="max-w-md"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            multiple
            disabled={uploading || state.publicPhotos.length >= 10}
            onChange={async (event) => {
              if (!event.target.files?.length) return;
              const files = Array.from(event.target.files).slice(0, Math.max(0, 10 - state.publicPhotos.length));
              if (!files.length) {
                toast.error('Maximum 10 photos allowed');
                return;
              }
              setUploading(true);
              try {
                const uploaded: PublicPhoto[] = [];
                for (const file of files) {
                  const asset = await uploadApi.publicLibraryPhoto(file, { libraryId });
                  uploaded.push({ url: asset.url, publicId: asset.publicId, caption: '', isCover: false, order: 0 });
                }
                setState((prev) => {
                  const merged = [...prev.publicPhotos, ...uploaded].map((photo, index) => ({
                    ...photo,
                    order: index,
                  }));
                  if (merged.length && !merged.some((photo) => photo.isCover)) merged[0].isCover = true;
                  return { ...prev, publicPhotos: merged };
                });
                toast.success(`${uploaded.length} photo(s) uploaded`);
              } catch {
                toast.error('Photo upload failed');
              } finally {
                setUploading(false);
                event.target.value = '';
              }
            }}
          />
          {state.publicPhotos.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {state.publicPhotos.map((photo, index) => (
                <div key={photo.publicId} className="overflow-hidden rounded-xl border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="Gallery" className="h-40 w-full object-cover" />
                  <div className="space-y-2 p-3">
                    <Input
                      placeholder="Caption (optional)"
                      value={photo.caption ?? ''}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          publicPhotos: prev.publicPhotos.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, caption: e.target.value } : row,
                          ),
                        }))
                      }
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={photo.isCover ? 'default' : 'outline'}
                        onClick={() =>
                          setState((prev) => ({
                            ...prev,
                            publicPhotos: prev.publicPhotos.map((row, rowIndex) => ({
                              ...row,
                              isCover: rowIndex === index,
                            })),
                          }))
                        }
                      >
                        {photo.isCover ? 'Cover photo' : 'Set as cover'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          setState((prev) => {
                            const next = prev.publicPhotos.filter((_, rowIndex) => rowIndex !== index);
                            if (next.length && !next.some((row) => row.isCover)) next[0].isCover = true;
                            return {
                              ...prev,
                              publicPhotos: next.map((row, rowIndex) => ({ ...row, order: rowIndex })),
                            };
                          })
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No photos yet. Upload images to show a premium gallery on your public page.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Amenities</CardTitle>
          <CardDescription>Select facilities shown as icon cards on your public page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {AMENITY_CATALOG.map((item) => {
              const active = state.amenities.some((a) => a.toLowerCase() === item.label.toLowerCase());
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleAmenity(item.label)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                    active ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/50',
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <div className="space-y-2">
            <Label htmlFor="customAmenity">Custom amenity</Label>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const input = (e.currentTarget.elements.namedItem('customAmenity') as HTMLInputElement).value.trim();
                if (!input) return;
                if (!state.amenities.some((a) => a.toLowerCase() === input.toLowerCase())) {
                  setState((prev) => ({ ...prev, amenities: [...prev.amenities, input] }));
                }
                (e.currentTarget.elements.namedItem('customAmenity') as HTMLInputElement).value = '';
              }}
            >
              <Input id="customAmenity" name="customAmenity" placeholder="e.g. Parking" />
              <Button type="submit" variant="outline">
                Add
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rules & visibility</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rules">Library rules (one per line)</Label>
            <textarea
              id="rules"
              className="flex min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              value={state.rulesText}
              onChange={(e) => setState((prev) => ({ ...prev, rulesText: e.target.value }))}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <ToggleRow
              label="Public page enabled"
              checked={state.publicPageEnabled}
              onChange={(v) => setState((prev) => ({ ...prev, publicPageEnabled: v }))}
            />
            <ToggleRow
              label="Online booking enabled"
              checked={state.bookingEnabled}
              onChange={(v) => setState((prev) => ({ ...prev, bookingEnabled: v }))}
            />
            <ToggleRow
              label="Show occupied/reserved seat counts publicly"
              description="When disabled, visitors only see available seats. Occupied and reserved seats are hidden as internal information."
              checked={state.showFullSeatBreakdown}
              onChange={(v) => setState((prev) => ({ ...prev, showFullSeatBreakdown: v }))}
            />
            <ToggleRow
              label="Show phone on public page"
              checked={state.showPhone}
              onChange={(v) => setState((prev) => ({ ...prev, showPhone: v }))}
            />
            <ToggleRow
              label="Show WhatsApp (uses library phone)"
              checked={state.showWhatsApp}
              onChange={(v) => setState((prev) => ({ ...prev, showWhatsApp: v }))}
            />
            <ToggleRow
              label="Show email"
              checked={state.showEmail}
              onChange={(v) => setState((prev) => ({ ...prev, showEmail: v }))}
            />
          </div>
        </CardContent>
      </Card>

      <Button type="button" size="lg" onClick={() => void saveSettings()}>
        <Save className="mr-2 h-4 w-4" />
        Save public page settings
      </Button>
    </div>
  );
}
