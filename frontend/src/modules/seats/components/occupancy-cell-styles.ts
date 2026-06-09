import type { OccupancyCellState } from '../types';

export const OCCUPANCY_LEGEND: Array<{ state: OccupancyCellState; label: string; color: string }> = [
  { state: 'AVAILABLE', label: 'Available', color: '#22c55e' },
  { state: 'OCCUPIED', label: 'Occupied', color: '#3b82f6' },
  { state: 'RESERVED', label: 'Reserved', color: '#eab308' },
  { state: 'PUBLIC_HOLD', label: 'Public hold', color: '#a855f7' },
  { state: 'BLOCKED', label: 'Blocked / conflict', color: '#ef4444' },
  { state: 'EXPIRED', label: 'Expired', color: '#94a3b8' },
];

export function cellStyle(state: OccupancyCellState): { bg: string; border: string; text: string } {
  const item = OCCUPANCY_LEGEND.find((l) => l.state === state) ?? OCCUPANCY_LEGEND[0];
  return {
    bg: `${item.color}22`,
    border: `${item.color}99`,
    text: item.color,
  };
}
