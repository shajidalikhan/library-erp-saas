import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';

vi.mock('@modules/platform/role-capability.service', () => ({
  roleCapabilityService: {
    getActionMatrixForRole: vi.fn(),
  },
}));

vi.mock('@modules/subscription-billing/subscription-feature.service', () => ({
  subscriptionFeatureService: {
    hasFeature: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@modules/platform/platform-audit.service', () => ({
  appendPlatformAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import { roleCapabilityService } from '@modules/platform/role-capability.service';
import { evaluateCapabilityAccess } from './capability-enforcement.service';

describe('evaluateCapabilityAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('denies when students.create action disabled', async () => {
    vi.mocked(roleCapabilityService.getActionMatrixForRole).mockResolvedValue({
      students: {
        view: true,
        create: false,
        edit: true,
        delete: false,
        export: true,
        transfer: true,
        assign_seat: true,
      },
    } as never);

    const result = await evaluateCapabilityAccess(
      {
        id: 'u1',
        role: ROLES.MANAGER,
        permissions: [PERMISSIONS.STUDENT_CREATE],
        libraryId: 'lib',
        branchId: null,
      },
      { module: 'students', action: 'create', permission: PERMISSIONS.STUDENT_CREATE },
    );

    expect(result.allowed).toBe(false);
    expect(result.source).toBe('role_capability');
  });
});
