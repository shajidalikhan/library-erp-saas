import { Types } from 'mongoose';

import { ROLES } from '@constants/roles.constants';
import type { RoleName } from '@constants/roles.constants';
import { RoleModel, UserModel } from '@modules/auth/auth.models';
import { ApiError } from '@utils/ApiError';
import { BranchModel } from '@modules/library/library.models';
import { InvoiceModel } from '@modules/payments/invoice.model';
import { StudentModel } from '@modules/students/students.models';

import type { SendNotificationBody } from './notifications.validation';

type Target = SendNotificationBody['target'];

/** Remove sender from broadcast audiences unless `includeSelf` is true. USER mode is never filtered. */
export function applyExcludeSelf(
  ids: Types.ObjectId[],
  senderUserId: string,
  includeSelf: boolean | undefined,
  targetMode: Target['mode'],
): Types.ObjectId[] {
  if (includeSelf === true || targetMode === 'USER') return ids;
  const sid = new Types.ObjectId(senderUserId);
  return ids.filter((id) => !id.equals(sid));
}

async function roleIdForName(name: string): Promise<Types.ObjectId | null> {
  const r = await RoleModel.findOne({ name: name.toUpperCase() }).select('_id').lean();
  return r?._id ?? null;
}

export async function resolveRecipientUserIds(args: {
  libraryId: Types.ObjectId | null;
  effectiveBranchId: Types.ObjectId | null;
  senderRole: RoleName;
  senderBranchId: string | null;
  target: Target;
}): Promise<Types.ObjectId[]> {
  const { libraryId, effectiveBranchId, senderRole, senderBranchId, target } = args;

  if (target.mode === 'PLATFORM') {
    if (senderRole !== ROLES.SUPER_ADMIN) throw ApiError.forbidden('Platform audience is restricted to super admins');
    return (await UserModel.find({ isActive: true }).distinct('_id')) as Types.ObjectId[];
  }

  if (!libraryId) throw ApiError.badRequest('Library context required');

  if (target.mode === 'USER') {
    const u = await UserModel.findById(target.userId).select('libraryId branchId').lean();
    if (!u?.libraryId || String(u.libraryId) !== String(libraryId)) throw ApiError.badRequest('Invalid recipient user');
    if (senderRole === ROLES.MANAGER && senderBranchId && String(u.branchId) !== senderBranchId) {
      throw ApiError.forbidden('Recipient outside managed branch');
    }
    return [new Types.ObjectId(target.userId)];
  }

  if (target.mode === 'ROLE') {
    const rid = await roleIdForName(target.role!);
    if (!rid) throw ApiError.badRequest('Unknown role');
    const q: Record<string, unknown> = { libraryId, role: rid, isActive: true };
    if (senderRole === ROLES.MANAGER) {
      if (!senderBranchId) throw ApiError.forbidden('Branch scope required');
      q.branchId = new Types.ObjectId(senderBranchId);
    } else if (effectiveBranchId) {
      q.branchId = effectiveBranchId;
    }
    return (await UserModel.find(q).distinct('_id')) as Types.ObjectId[];
  }

  if (target.mode === 'BRANCH') {
    const b = await BranchModel.findById(target.branchId).select('libraryId').lean();
    if (!b || String(b.libraryId) !== String(libraryId)) throw ApiError.badRequest('Invalid branch');
    if (senderRole === ROLES.MANAGER && senderBranchId && target.branchId !== senderBranchId) {
      throw ApiError.forbidden('Cannot target another branch');
    }
    return (await UserModel.find({
      libraryId,
      branchId: new Types.ObjectId(target.branchId),
      isActive: true,
    }).distinct('_id')) as Types.ObjectId[];
  }

  if (target.mode === 'LIBRARY') {
    if (senderRole === ROLES.MANAGER) {
      if (!senderBranchId) throw ApiError.forbidden('Managers cannot broadcast outside their branch');
      return (await UserModel.find({
        libraryId,
        branchId: new Types.ObjectId(senderBranchId),
        isActive: true,
      }).distinct('_id')) as Types.ObjectId[];
    }
    const q: Record<string, unknown> = { libraryId, isActive: true };
    if (effectiveBranchId) q.branchId = effectiveBranchId;
    return (await UserModel.find(q).distinct('_id')) as Types.ObjectId[];
  }

  if (target.mode === 'STUDENTS_WITH_DUES') {
    const invMatch: Record<string, unknown> = {
      libraryId,
      dueAmount: { $gt: 0.01 },
      status: { $in: ['UNPAID', 'PARTIAL', 'OVERDUE'] },
    };
    if (senderRole === ROLES.MANAGER && senderBranchId) {
      invMatch.branchId = new Types.ObjectId(senderBranchId);
    } else if (effectiveBranchId) {
      invMatch.branchId = effectiveBranchId;
    }

    const agg = await InvoiceModel.aggregate<{ uid: Types.ObjectId }>([
      { $match: invMatch },
      { $group: { _id: '$studentId' } },
      {
        $lookup: {
          from: StudentModel.collection.name,
          localField: '_id',
          foreignField: '_id',
          as: 'st',
        },
      },
      { $match: { 'st.userId': { $ne: null } } },
      { $project: { _id: 0, uid: { $arrayElemAt: ['$st.userId', 0] } } },
    ]);
    const raw = agg.map((x) => String(x.uid)).filter(Boolean);
    return [...new Set(raw)].map((id) => new Types.ObjectId(id));
  }

  throw ApiError.badRequest('Invalid notification target');
}
