import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

import { StudentModel } from '@modules/students/students.models';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { SeatModel } from '@modules/seats/seat.model';
import { UserModel } from '@modules/auth/auth.models';

vi.mock('@/services/upload.service', () => ({
  clearStoredMedia: vi.fn().mockResolvedValue(undefined),
  safeDeleteCloudinaryAsset: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@modules/students/students.models');
vi.mock('@modules/library/library.models');
vi.mock('@modules/seats/seat.model');
vi.mock('@modules/auth/auth.models');
vi.mock('@modules/attendance/attendance.model', () => ({
  AttendanceModel: { deleteMany: vi.fn().mockResolvedValue({}) },
}));
vi.mock('@modules/membership/membership.model', () => ({
  MembershipModel: { deleteMany: vi.fn().mockResolvedValue({}) },
}));
vi.mock('@modules/shifts/shift.model', () => ({
  ShiftModel: { deleteMany: vi.fn().mockResolvedValue({}) },
}));
vi.mock('@modules/payments/payments.models', () => ({
  InvoiceModel: {
    find: vi.fn().mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([]) }),
    }),
    deleteMany: vi.fn().mockResolvedValue({}),
    exists: vi.fn(),
  },
  PaymentRecordModel: {
    find: vi.fn().mockResolvedValue([]),
    deleteMany: vi.fn().mockResolvedValue({}),
    exists: vi.fn(),
  },
  RefundModel: { deleteMany: vi.fn().mockResolvedValue({}) },
  FeePlanModel: { deleteMany: vi.fn().mockResolvedValue({}) },
}));
vi.mock('@modules/seats/seat-assignment.model', () => ({
  SeatAssignmentModel: { deleteMany: vi.fn().mockResolvedValue({}) },
}));
vi.mock('@modules/notifications/notification.model', () => ({
  NotificationModel: { deleteMany: vi.fn().mockResolvedValue({}) },
}));
vi.mock('@modules/notifications/notification-log.model', () => ({
  NotificationLogModel: { deleteMany: vi.fn().mockResolvedValue({}) },
}));
vi.mock('@modules/notifications/notification-template.model', () => ({
  NotificationTemplateModel: { deleteMany: vi.fn().mockResolvedValue({}) },
}));
vi.mock('@modules/subscription-billing/library-subscription.model', () => ({
  LibrarySubscriptionModel: { deleteMany: vi.fn().mockResolvedValue({}) },
}));
vi.mock('@modules/subscription-billing/subscription-event.model', () => ({
  SubscriptionEventModel: { deleteMany: vi.fn().mockResolvedValue({}) },
}));
vi.mock('@modules/platform/tenant-usage-snapshot.model', () => ({
  TenantUsageSnapshotModel: { deleteMany: vi.fn().mockResolvedValue({}) },
}));
vi.mock('@modules/platform/audit-log.model', () => ({
  AuditLogModel: { deleteMany: vi.fn().mockResolvedValue({}) },
}));
vi.mock('@modules/students/student-field-config.model', () => ({
  StudentFieldConfigModel: { deleteMany: vi.fn().mockResolvedValue({}) },
}));

import { clearStoredMedia } from '@/services/upload.service';
import { cascadeDeleteBranch, getBranchDeleteImpact } from './tenant-cleanup.service';

describe('tenant-cleanup.service', () => {
  const libraryId = new Types.ObjectId().toString();
  const branchId = new Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns branch delete impact counts', async () => {
    vi.mocked(StudentModel.countDocuments).mockResolvedValue(3);
    vi.mocked(SeatModel.countDocuments).mockResolvedValue(10);
    vi.mocked(UserModel.countDocuments).mockResolvedValue(2);

    const impact = await getBranchDeleteImpact(libraryId, branchId);
    expect(impact).toEqual({ students: 3, seats: 10, staff: 2 });
  });

  it('deletes branch media via clearStoredMedia', async () => {
    const logo = { publicId: 'branches/logo1', url: 'https://example.com/l.png' };
    vi.mocked(BranchModel.findOne).mockReturnValue({
      lean: () => Promise.resolve({ _id: branchId, libraryId, logo }),
    } as never);
    vi.mocked(StudentModel.find).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([]) }),
      lean: () => Promise.resolve([]),
    } as never);
    vi.mocked(BranchModel.deleteOne).mockResolvedValue({} as never);

    await cascadeDeleteBranch(libraryId, branchId);
    expect(clearStoredMedia).toHaveBeenCalledWith(logo);
  });
});
