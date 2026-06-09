import { Types } from 'mongoose';

import { RoleModel, UserModel } from '@modules/auth/auth.models';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { SeatModel } from '@modules/seats/seat.model';
import { StudentModel } from '@modules/students/students.models';

export type BranchDisplay = { branchName: string; branchCode: string };
export type LibraryDisplay = { libraryName: string; librarySlug?: string };
export type StudentDisplay = { studentName: string; studentCode: string; studentPhone?: string | null };
export type SeatDisplay = {
  seatNumber: string;
  seatFloor?: string | null;
  seatZone?: string | null;
  seatType?: string | null;
  shiftType?: string | null;
  seatStatus?: string | null;
};
export type UserDisplay = { userName: string; userEmail: string; roleName?: string | null };

const toObjectId = (value: unknown): Types.ObjectId | null => {
  if (!value) return null;
  const id = String(value);
  return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null;
};

const uniqueObjectIds = (values: unknown[]): Types.ObjectId[] => {
  const seen = new Set<string>();
  const out: Types.ObjectId[] = [];
  for (const value of values) {
    const objectId = toObjectId(value);
    if (!objectId) continue;
    const key = String(objectId);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(objectId);
  }
  return out;
};

const collectIds = (rows: Record<string, unknown>[], keys: string[]): Types.ObjectId[] =>
  uniqueObjectIds(rows.flatMap((row) => keys.map((key) => row[key])));

export async function lookupBranchMap(ids: Types.ObjectId[]): Promise<Map<string, BranchDisplay>> {
  if (!ids.length) return new Map();
  const rows = await BranchModel.find({ _id: { $in: ids } }).select('branchName branchCode').lean();
  return new Map(
    rows.map((row) => [
      String(row._id),
      { branchName: String(row.branchName), branchCode: String(row.branchCode) },
    ]),
  );
}

export async function lookupLibraryMap(ids: Types.ObjectId[]): Promise<Map<string, LibraryDisplay>> {
  if (!ids.length) return new Map();
  const rows = await LibraryModel.find({ _id: { $in: ids } }).select('name slug').lean();
  return new Map(
    rows.map((row) => [
      String(row._id),
      { libraryName: String(row.name), librarySlug: row.slug ? String(row.slug) : undefined },
    ]),
  );
}

export async function lookupStudentMap(ids: Types.ObjectId[]): Promise<Map<string, StudentDisplay>> {
  if (!ids.length) return new Map();
  const rows = await StudentModel.find({ _id: { $in: ids } }).select('fullName studentId phone').lean();
  return new Map(
    rows.map((row) => [
      String(row._id),
      {
        studentName: String(row.fullName),
        studentCode: String(row.studentId),
        studentPhone: row.phone ? String(row.phone) : null,
      },
    ]),
  );
}

export async function lookupSeatMap(ids: Types.ObjectId[]): Promise<Map<string, SeatDisplay>> {
  if (!ids.length) return new Map();
  const rows = await SeatModel.find({ _id: { $in: ids } })
    .select('seatNumber floor zone seatType shiftType status')
    .lean();
  return new Map(
    rows.map((row) => [
      String(row._id),
      {
        seatNumber: String(row.seatNumber),
        seatFloor: row.floor ? String(row.floor) : null,
        seatZone: row.zone ? String(row.zone) : null,
        seatType: row.seatType ? String(row.seatType) : null,
        shiftType: row.shiftType ? String(row.shiftType) : null,
        seatStatus: row.status ? String(row.status) : null,
      },
    ]),
  );
}

export async function lookupUserMap(ids: Types.ObjectId[]): Promise<Map<string, UserDisplay>> {
  if (!ids.length) return new Map();
  const rows = await UserModel.aggregate<{
    _id: Types.ObjectId;
    fullName: string;
    email: string;
    roleName: string | null;
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
      $project: {
        fullName: 1,
        email: 1,
        roleName: { $arrayElemAt: ['$roleDoc.name', 0] },
      },
    },
  ]);
  return new Map(
    rows.map((row) => [
      String(row._id),
      {
        userName: String(row.fullName),
        userEmail: String(row.email),
        roleName: row.roleName ? String(row.roleName) : null,
      },
    ]),
  );
}

export type DisplayEnrichmentSpec = {
  branchIdKey?: string;
  libraryIdKey?: string;
  studentIdKey?: string;
  seatIdKey?: string;
  userIdKeys?: string[];
};

export async function enrichRowsWithLookups<Row extends Record<string, unknown>>(
  rows: Row[],
  spec: DisplayEnrichmentSpec,
): Promise<Array<Row & Record<string, unknown>>> {
  if (!rows.length) return [];

  const [branchMap, libraryMap, studentMap, seatMap, userMap] = await Promise.all([
    spec.branchIdKey ? lookupBranchMap(collectIds(rows, [spec.branchIdKey])) : Promise.resolve(new Map()),
    spec.libraryIdKey ? lookupLibraryMap(collectIds(rows, [spec.libraryIdKey])) : Promise.resolve(new Map()),
    spec.studentIdKey ? lookupStudentMap(collectIds(rows, [spec.studentIdKey])) : Promise.resolve(new Map()),
    spec.seatIdKey ? lookupSeatMap(collectIds(rows, [spec.seatIdKey])) : Promise.resolve(new Map()),
    spec.userIdKeys?.length
      ? lookupUserMap(collectIds(rows, spec.userIdKeys))
      : Promise.resolve(new Map()),
  ]);

  return rows.map((row) => {
    const next: Record<string, unknown> = { ...row };

    if (spec.branchIdKey) {
      const branch = branchMap.get(String(row[spec.branchIdKey]));
      next.branchName = branch?.branchName ?? null;
      next.branchCode = branch?.branchCode ?? null;
    }

    if (spec.libraryIdKey) {
      const library = libraryMap.get(String(row[spec.libraryIdKey]));
      next.libraryName = library?.libraryName ?? null;
      next.librarySlug = library?.librarySlug ?? null;
    }

    if (spec.studentIdKey) {
      const student = studentMap.get(String(row[spec.studentIdKey]));
      next.studentName = student?.studentName ?? null;
      next.studentCode = student?.studentCode ?? null;
      next.studentPhone = student?.studentPhone ?? null;
    }

    if (spec.seatIdKey) {
      const seat = seatMap.get(String(row[spec.seatIdKey]));
      next.seatNumber = seat?.seatNumber ?? null;
      next.seatFloor = seat?.seatFloor ?? null;
      next.seatZone = seat?.seatZone ?? null;
      next.seatType = seat?.seatType ?? null;
      next.shiftType = seat?.shiftType ?? null;
      next.seatStatus = seat?.seatStatus ?? null;
    }

    for (const userIdKey of spec.userIdKeys ?? []) {
      const user = userMap.get(String(row[userIdKey]));
      if (userIdKey === 'recipientUserId') {
        next.recipientName = user?.userName ?? null;
        next.recipientEmail = user?.userEmail ?? null;
        next.recipientRole = user?.roleName ?? null;
      } else if (userIdKey === 'createdBy') {
        next.createdByName = user?.userName ?? null;
        next.createdByEmail = user?.userEmail ?? null;
      } else if (userIdKey === 'updatedBy') {
        next.updatedByName = user?.userName ?? null;
        next.updatedByEmail = user?.userEmail ?? null;
      } else if (userIdKey === 'actorUserId') {
        next.actorName = user?.userName ?? null;
        next.actorEmail = user?.userEmail ?? null;
      } else if (userIdKey === 'assignedTo') {
        next.assignedToName = user?.userName ?? null;
        next.assignedToEmail = user?.userEmail ?? null;
      } else if (userIdKey === 'receivedBy') {
        next.receivedByName = user?.userName ?? null;
        next.receivedByEmail = user?.userEmail ?? null;
      } else {
        next.userName = user?.userName ?? null;
        next.userEmail = user?.userEmail ?? null;
        next.roleName = user?.roleName ?? null;
      }
    }

    return next as Row & Record<string, unknown>;
  });
}

export async function enrichSingleRowWithLookups<Row extends Record<string, unknown>>(
  row: Row,
  spec: DisplayEnrichmentSpec,
): Promise<Row & Record<string, unknown>> {
  const [enriched] = await enrichRowsWithLookups([row], spec);
  return enriched;
}
