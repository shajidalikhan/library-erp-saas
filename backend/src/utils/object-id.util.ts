import { Types } from 'mongoose';

import { ApiError } from '@utils/ApiError';

const INVALID_SENTINELS = new Set(['', 'all', 'null', 'undefined']);

export function requireObjectId(
  value: string | undefined | null,
  label: string,
): Types.ObjectId {
  const trimmed = String(value ?? '').trim();
  if (INVALID_SENTINELS.has(trimmed.toLowerCase()) || !Types.ObjectId.isValid(trimmed)) {
    throw ApiError.badRequest(`Valid ${label} required`);
  }
  return new Types.ObjectId(trimmed);
}

export function optionalObjectId(
  value: string | undefined | null,
  label: string,
): Types.ObjectId | undefined {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return undefined;
  return requireObjectId(trimmed, label);
}
