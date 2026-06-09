/**
 * Application-wide role identifiers.
 * Keep this in sync with the seeded Role documents in MongoDB.
 *
 * Hierarchy (highest -> lowest):
 *   SUPER_ADMIN      -> platform owner (cross-tenant, system-wide)
 *   LIBRARY_OWNER    -> tenant owner (full access inside a library)
 *   MANAGER          -> branch level manager
 *   RECEPTIONIST     -> front desk staff
 *   ACCOUNTANT       -> finance/payments staff
 *   SECURITY         -> physical security / attendance checks
 *   STUDENT          -> end user
 */
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  LIBRARY_OWNER: 'LIBRARY_OWNER',
  MANAGER: 'MANAGER',
  RECEPTIONIST: 'RECEPTIONIST',
  ACCOUNTANT: 'ACCOUNTANT',
  SECURITY: 'SECURITY',
  STUDENT: 'STUDENT',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: RoleName[] = Object.values(ROLES);

/**
 * Public self-registration is disabled. All accounts are provisioned by
 * SUPER_ADMIN or LIBRARY_OWNER via the users/staff APIs.
 */
export const PUBLIC_REGISTRATION_ROLES: RoleName[] = [];

/**
 * Roles considered "staff" (i.e. members of a library team).
 */
export const STAFF_ROLES: RoleName[] = [
  ROLES.LIBRARY_OWNER,
  ROLES.MANAGER,
  ROLES.RECEPTIONIST,
  ROLES.ACCOUNTANT,
  ROLES.SECURITY,
];
