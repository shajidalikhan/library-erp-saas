import { describe, expect, it } from 'vitest';

import { PERMISSIONS, ROLE_PERMISSIONS } from '@constants/permissions.constants';
import { ROLES } from '@constants/roles.constants';

import { resolveUserPermissions } from './resolve-user-permissions';

describe('resolveUserPermissions', () => {
  it('merges catalog defaults for library owner when DB role is missing booking permissions', () => {
    const perms = resolveUserPermissions(ROLES.LIBRARY_OWNER, [
      { name: 'library.read' },
      { name: 'student.read' },
    ]);
    expect(perms).toContain(PERMISSIONS.BOOKING_READ);
    expect(perms).toContain(PERMISSIONS.BOOKING_MANAGE);
    expect(perms).toContain(PERMISSIONS.PUBLIC_PAGE_MANAGE);
  });

  it('canonicalizes lowercase permission names from MongoDB', () => {
    const perms = resolveUserPermissions(ROLES.MANAGER, [
      { name: 'publicpage.read' },
      { name: 'booking.read' },
    ]);
    expect(perms).toContain(PERMISSIONS.PUBLIC_PAGE_READ);
    expect(perms).toContain(PERMISSIONS.BOOKING_READ);
    expect(perms).toEqual(
      expect.arrayContaining(ROLE_PERMISSIONS[ROLES.MANAGER]),
    );
  });
});
