import { ROUTES } from '@/constants/routes';
import type { AuthUser } from '@/types/auth';
import { ROLES } from '@/constants/permissions';

/**
 * First destination after a successful universal login (email + password).
 */
export function getPostLoginPath(user: AuthUser): string {
  switch (user.role) {
    case ROLES.SUPER_ADMIN:
      return ROUTES.LIBRARIES;
    case ROLES.ACCOUNTANT:
      return ROUTES.PAYMENTS;
    case ROLES.SECURITY:
      return ROUTES.ATTENDANCE;
    case ROLES.MANAGER:
    case ROLES.RECEPTIONIST:
      return ROUTES.STUDENTS;
    case ROLES.STUDENT:
      return ROUTES.STUDENT_PORTAL;
    default:
      return ROUTES.DASHBOARD;
  }
}
