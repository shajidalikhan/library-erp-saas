import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';

import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import type { AuthenticatedUser } from '@/types/express';

import { libraryService } from './library.service';
import { LibraryModel } from './library.models';

const libraryId = new Types.ObjectId().toString();

const ownerUser: AuthenticatedUser = {
  id: new Types.ObjectId().toString(),
  role: ROLES.LIBRARY_OWNER,
  permissions: [PERMISSIONS.LIBRARY_UPDATE],
  libraryId,
  branchId: null,
};

function mockLibrary() {
  return {
    _id: new Types.ObjectId(libraryId),
    slug: 'demo-lib',
    ownerId: null,
    settings: {},
    save: vi.fn().mockResolvedValue(undefined),
  };
}

describe('libraryService.updateLibrary owner restrictions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects library owner changing subscription plan', async () => {
    vi.spyOn(LibraryModel, 'findById').mockResolvedValue(mockLibrary() as never);
    await expect(
      libraryService.updateLibrary(ownerUser, libraryId, { subscriptionPlan: 'ENTERPRISE' }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects library owner changing tenant status', async () => {
    vi.spyOn(LibraryModel, 'findById').mockResolvedValue(mockLibrary() as never);
    await expect(
      libraryService.updateLibrary(ownerUser, libraryId, { status: 'SUSPENDED' }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

});
