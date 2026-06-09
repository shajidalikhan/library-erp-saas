import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ROLES } from '@constants/roles.constants';
import { ApiError } from '@utils/ApiError';

vi.mock('./role-capability.model', () => ({
  RoleCapabilityConfigModel: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

import { RoleCapabilityConfigModel } from './role-capability.model';
import { roleCapabilityService } from './role-capability.service';

describe('roleCapabilityService action matrix', () => {
  beforeEach(() => {
    roleCapabilityService.invalidateCache();
    vi.clearAllMocks();
  });

  it('defaults library owner public_booking.view to enabled', async () => {
    vi.mocked(RoleCapabilityConfigModel.findOne).mockReturnValue({
      lean: () => Promise.resolve(null),
    } as never);
    const enabled = await roleCapabilityService.isActionEnabled(
      ROLES.LIBRARY_OWNER,
      'public_booking',
      'view',
    );
    expect(enabled).toBe(true);
  });

  it('defaults manager students.create to enabled', async () => {
    vi.mocked(RoleCapabilityConfigModel.findOne).mockReturnValue({
      lean: () => Promise.resolve(null),
    } as never);
    const enabled = await roleCapabilityService.isActionEnabled(
      ROLES.MANAGER,
      'students',
      'create',
    );
    expect(enabled).toBe(true);
  });

  it('blocks API when students.create disabled via patch', async () => {
    vi.mocked(RoleCapabilityConfigModel.findOne)
      .mockReturnValueOnce({
        lean: () => Promise.resolve(null),
      } as never)
      .mockReturnValueOnce({
        lean: () =>
          Promise.resolve({
            overrides: {
              MANAGER: {
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
            },
          }),
      } as never);
    vi.mocked(RoleCapabilityConfigModel.findOneAndUpdate).mockResolvedValue({} as never);

    await roleCapabilityService.patchRoleCapabilities(ROLES.MANAGER, {
      actions: { students: { create: false } },
    });
    roleCapabilityService.invalidateCache();

    vi.mocked(RoleCapabilityConfigModel.findOne).mockReturnValue({
      lean: () =>
        Promise.resolve({
          overrides: {
            MANAGER: {
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
          },
        }),
    } as never);

    const enabled = await roleCapabilityService.isActionEnabled(
      ROLES.MANAGER,
      'students',
      'create',
    );
    expect(enabled).toBe(false);
  });

  it('getConfigurableMatrix returns normalized action rows', async () => {
    vi.mocked(RoleCapabilityConfigModel.findOne).mockReturnValue({
      lean: () => Promise.resolve(null),
    } as never);
    roleCapabilityService.invalidateCache();

    const config = await roleCapabilityService.getConfigurableMatrix();
    const managerRow = config.matrix.MANAGER;
    expect(managerRow.students.view).toBe(true);
    expect(managerRow.attendance.view).toBe(true);
    expect(config.moduleFlags.MANAGER.attendance).toBe(true);
  });

  it('assertActionEnabledAsync throws for disabled action', async () => {
    vi.mocked(RoleCapabilityConfigModel.findOne).mockReturnValue({
      lean: () =>
        Promise.resolve({
          overrides: {
            MANAGER: { students: { create: false } },
          },
        }),
    } as never);
    roleCapabilityService.invalidateCache();

    await expect(
      roleCapabilityService.assertActionEnabledAsync(
        { id: '1', role: ROLES.MANAGER, permissions: [], libraryId: 'lib', branchId: 'br' },
        'students',
        'create',
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
