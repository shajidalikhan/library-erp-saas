import type { LucideIcon } from 'lucide-react';
import {
  Armchair,
  Bath,
  Camera,
  Droplets,
  Shield,
  Snowflake,
  VolumeX,
  Wifi,
  Zap,
} from 'lucide-react';

export type AmenityCatalogItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  keywords: string[];
};

export const AMENITY_CATALOG: AmenityCatalogItem[] = [
  { key: 'ac', label: 'AC Study Hall', icon: Snowflake, keywords: ['ac', 'air condition', 'cooling'] },
  { key: 'wifi', label: 'WiFi', icon: Wifi, keywords: ['wifi', 'wi-fi', 'internet'] },
  { key: 'cctv', label: 'CCTV', icon: Camera, keywords: ['cctv', 'camera', 'security cam'] },
  { key: 'water', label: 'RO Water', icon: Droplets, keywords: ['ro', 'water', 'purifier'] },
  { key: 'power', label: 'Power Backup', icon: Zap, keywords: ['power', 'backup', 'generator', 'inverter'] },
  { key: 'silent', label: 'Silent Zone', icon: VolumeX, keywords: ['silent', 'quiet', 'no noise'] },
  { key: 'seat', label: 'Personal Seat', icon: Armchair, keywords: ['seat', 'desk', 'personal'] },
  { key: 'washroom', label: 'Washroom', icon: Bath, keywords: ['washroom', 'toilet', 'restroom'] },
  { key: 'locker', label: 'Locker', icon: Shield, keywords: ['locker', 'storage', 'safe'] },
];

export function matchAmenityItem(name: string): AmenityCatalogItem | null {
  const lower = name.toLowerCase();
  return AMENITY_CATALOG.find((item) => item.keywords.some((k) => lower.includes(k))) ?? null;
}

export function resolveDisplayAmenities(ownerAmenities: string[]): Array<{
  label: string;
  icon: LucideIcon;
  custom?: boolean;
}> {
  if (!ownerAmenities.length) return [];
  return ownerAmenities.map((name) => {
    const matched = matchAmenityItem(name);
    if (matched) return { label: name.trim() || matched.label, icon: matched.icon };
    return { label: name, icon: Shield, custom: true };
  });
}
