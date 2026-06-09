'use client';

import { useMemo } from 'react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import type { Seat } from '../types';
import { seatStatusHex } from './seat-status-badge';

export interface SeatGridViewProps {
  seats: Seat[];
  floor: string;
  zone: string;
  onFloorChange: (v: string) => void;
  onZoneChange: (v: string) => void;
  floors: string[];
  zones: string[];
}

export function SeatGridView({
  seats,
  floor,
  zone,
  floors,
  zones,
  onFloorChange,
  onZoneChange,
}: SeatGridViewProps) {
  const filtered = useMemo(
    () => seats.filter((s) => s.floor === floor && s.zone === zone),
    [seats, floor, zone],
  );

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => a.seatNumber.localeCompare(b.seatNumber)),
    [filtered],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Floor</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={floor}
            onChange={(e) => onFloorChange(e.target.value)}
          >
            {floors.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Zone</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={zone}
            onChange={(e) => onZoneChange(e.target.value)}
          >
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No seats for this floor/zone.</p>
      ) : (
        <TooltipProvider delayDuration={200}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-2 max-w-5xl">
            {sorted.map((seat) => {
              const bg = seatStatusHex(seat.status);
              const opacity = seat.active ? 1 : 0.45;
              return (
                <Tooltip key={seat._id}>
                  <TooltipTrigger asChild>
                    <div
                      className="aspect-square rounded-md border text-[10px] font-medium flex items-center justify-center cursor-default transition-transform hover:scale-105"
                      style={{
                        backgroundColor: `${bg}33`,
                        borderColor: `${bg}99`,
                        color: bg,
                        opacity,
                      }}
                    >
                      <span className="truncate px-0.5 text-center leading-tight">{seat.seatNumber}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    <p className="font-semibold">{seat.seatNumber}</p>
                    <p>Status: {seat.status}</p>
                    <p>Occupied: {seat.occupied ? 'Yes' : 'No'}</p>
                    <p>Type: {seat.seatType}</p>
                    {seat.assignedStudentId ? (
                      <p className="text-muted-foreground">Student linked</p>
                    ) : null}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2">
        {(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE', 'BLOCKED'] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: seatStatusHex(s) }} />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
