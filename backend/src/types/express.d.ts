import type { RoleName } from '@constants/roles.constants';
import type { PermissionName } from '@constants/permissions.constants';

/**
 * Augments Express's `Request` with the authenticated user context that
 * `auth.middleware.ts` attaches after verifying the access token.
 *
 * Keep this type small and serializable - it is the only thing every
 * downstream handler should rely on.
 */
export interface AuthenticatedUser {
  id: string;
  role: RoleName;
  permissions: PermissionName[];
  libraryId: string | null;
  branchId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      requestId?: string;
      validatedBody?: unknown;
      validatedQuery?: unknown;
      validatedParams?: unknown;
      /** Future impersonation context (see impersonation.middleware). */
      impersonation?: { actorUserId: string; subjectUserId: string } | null;
    }
  }
}

export {};
