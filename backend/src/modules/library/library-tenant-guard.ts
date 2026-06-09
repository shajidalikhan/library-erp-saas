import { ROLES } from '@constants/roles.constants';
import { HTTP_STATUS } from '@constants/http.constants';
import { ApiError } from '@utils/ApiError';

import { LIBRARY_STATUS } from './library.constants';
import { LibraryModel } from './library.models';

export type TenantSuspensionDetails = {
  suspensionReason: string | null;
  libraryName: string;
};

/**
 * Blocks tenant-bound users when the library is suspended.
 * SUPER_ADMIN and users without a library pass through.
 */
export async function assertTenantLibraryActive(
  libraryId: string | null | undefined,
  roleName: string,
): Promise<void> {
  if (!libraryId || roleName === ROLES.SUPER_ADMIN) return;

  const lib = await LibraryModel.findById(libraryId)
    .select('status suspendedAt suspensionReason name')
    .lean();

  if (!lib) return;

  const suspended = lib.status === LIBRARY_STATUS.SUSPENDED || Boolean(lib.suspendedAt);
  if (!suspended) return;

  throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Your library account has been suspended.', {
    code: 'TENANT_SUSPENDED',
    details: {
      suspensionReason: lib.suspensionReason ?? null,
      libraryName: lib.name,
    } satisfies TenantSuspensionDetails,
  });
}
