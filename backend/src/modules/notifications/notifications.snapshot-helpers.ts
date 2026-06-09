import { Types } from 'mongoose';

import { RoleModel, UserModel } from '@modules/auth/auth.models';
import { BranchModel, LibraryModel } from '@modules/library/library.models';

export type RecipientRow = {
  userId: string;
  libraryId: string | null;
  branchId: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
  role: string;
  branchName: string | null;
  libraryName: string | null;
};

export async function buildRecipientRows(ids: Types.ObjectId[]): Promise<RecipientRow[]> {
  if (ids.length === 0) return [];
  const rows = await UserModel.aggregate<{
    _id: Types.ObjectId;
    fullName: string;
    email: string;
    phone?: string | null;
    libraryId: Types.ObjectId | null;
    branchId: Types.ObjectId | null;
    roleName: string | null;
    branchName: string | null;
    libraryName: string | null;
  }>([
    { $match: { _id: { $in: ids } } },
    {
      $lookup: {
        from: RoleModel.collection.name,
        localField: 'role',
        foreignField: '_id',
        as: 'roleDoc',
      },
    },
    {
      $lookup: {
        from: BranchModel.collection.name,
        localField: 'branchId',
        foreignField: '_id',
        as: 'branchDoc',
      },
    },
    {
      $lookup: {
        from: LibraryModel.collection.name,
        localField: 'libraryId',
        foreignField: '_id',
        as: 'libDoc',
      },
    },
    {
      $project: {
        _id: 1,
        fullName: 1,
        email: 1,
        phone: 1,
        libraryId: 1,
        branchId: 1,
        roleName: { $arrayElemAt: ['$roleDoc.name', 0] },
        branchName: { $arrayElemAt: ['$branchDoc.branchName', 0] },
        libraryName: { $arrayElemAt: ['$libDoc.name', 0] },
      },
    },
    { $sort: { fullName: 1 } },
  ]);
  return rows.map((r) => ({
    userId: String(r._id),
    libraryId: r.libraryId ? String(r.libraryId) : null,
    branchId: r.branchId ? String(r.branchId) : null,
    fullName: r.fullName,
    email: r.email,
    phone: r.phone ?? null,
    role: r.roleName ? String(r.roleName) : '',
    branchName: r.branchName ? String(r.branchName) : null,
    libraryName: r.libraryName ? String(r.libraryName) : null,
  }));
}

export function defaultStatusBreakdown(sent: number): { SENT: number; FAILED: number; PENDING: number } {
  return { SENT: sent, FAILED: 0, PENDING: 0 };
}
