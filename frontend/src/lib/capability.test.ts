import { describe, expect, it } from 'vitest';

import { PERMISSIONS, ROLES } from '@/constants/permissions';
import { canUseModule, canUsePermission } from '@/lib/capability';

describe('canUseModule', () => {
  it('denies when role capability action is disabled', () => {
    const result = canUseModule({
      role: ROLES.MANAGER,
      module: 'students',
      action: 'create',
      permissions: [PERMISSIONS.STUDENT_CREATE],
      roleCapabilities: {
        students: {
          view: true,
          create: false,
          edit: true,
          delete: false,
          export: true,
          transfer: true,
          assign_seat: true,
        },
      },
    });
    expect(result.allowed).toBe(false);
    expect(result.source).toBe('role_capability');
  });

  it('denies view when module actions exist but view is false', () => {
    const result = canUseModule({
      role: ROLES.MANAGER,
      module: 'attendance',
      action: 'view',
      permissions: [PERMISSIONS.ATTENDANCE_READ],
      roleCapabilities: {
        attendance: { view: false, checkin: true, checkout: true, export: false },
      },
    });
    expect(result.allowed).toBe(false);
  });

  it('allows super admin bypass', () => {
    const result = canUseModule({
      role: ROLES.SUPER_ADMIN,
      module: 'students',
      action: 'create',
      permissions: [],
    });
    expect(result.allowed).toBe(true);
  });
});

describe('canUsePermission', () => {
  it('maps student.create to students.create capability', () => {
    const result = canUsePermission(PERMISSIONS.STUDENT_CREATE, {
      role: ROLES.MANAGER,
      permissions: [PERMISSIONS.STUDENT_CREATE],
      roleCapabilities: {
        students: { create: false, view: true } as Record<string, boolean>,
      },
    });
    expect(result.allowed).toBe(false);
  });
});
