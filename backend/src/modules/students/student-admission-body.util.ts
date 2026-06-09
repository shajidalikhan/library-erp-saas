import type { Request } from 'express';

import { parseStudentMultipartBody } from './student-body.util';

const JSON_FIELDS = ['membership', 'seatAssignment', 'payment'] as const;

export function parseAdmissionMultipartBody(req: Request): Record<string, unknown> {
  const out = parseStudentMultipartBody(req);

  for (const key of JSON_FIELDS) {
    const raw = out[key];
    if (typeof raw === 'string' && raw.trim()) {
      try {
        out[key] = JSON.parse(raw) as unknown;
      } catch {
        throw new Error(`Invalid JSON for ${key}`);
      }
    }
  }

  return out;
}
