import { Types } from 'mongoose';

import { ROLES, type RoleName } from '@constants/roles.constants';
import { LibraryModel } from '@modules/library/library.models';

import { UserModel } from './auth.models';
import type { IUserDocument } from './user.model';

/**
 * Ensures `LIBRARY_OWNER` users have `libraryId` populated when they already
 * own a library (`Library.ownerId`) but the User document was not synced.
 *
 * Persists the fix to MongoDB so JWT issuance and `/auth/me` stay aligned.
 */
export async function resolveLibraryOwnerTenantIds(
  userId: Types.ObjectId,
  roleName: RoleName | string,
  currentLibraryId: Types.ObjectId | null | undefined,
  currentBranchId: Types.ObjectId | null | undefined,
): Promise<{ libraryId: string | null; branchId: string | null }> {
  let libraryId = currentLibraryId ? String(currentLibraryId) : null;
  const branchId = currentBranchId ? String(currentBranchId) : null;

  if (roleName === ROLES.LIBRARY_OWNER && !libraryId) {
    const owned = await LibraryModel.findOne({ ownerId: userId }).select('_id').lean();
    if (owned?._id) {
      await UserModel.updateOne({ _id: userId }, { $set: { libraryId: owned._id, branchId: null } });
      return { libraryId: String(owned._id), branchId: null };
    }
  }

  return { libraryId, branchId };
}

export async function applyResolvedTenantToUserDocument(
  user: IUserDocument,
  roleName: RoleName,
): Promise<void> {
  const resolved = await resolveLibraryOwnerTenantIds(
    user._id as Types.ObjectId,
    roleName,
    user.libraryId as Types.ObjectId | null | undefined,
    user.branchId as Types.ObjectId | null | undefined,
  );
  user.libraryId = resolved.libraryId ? new Types.ObjectId(resolved.libraryId) : null;
  user.branchId = resolved.branchId ? new Types.ObjectId(resolved.branchId) : null;
}
