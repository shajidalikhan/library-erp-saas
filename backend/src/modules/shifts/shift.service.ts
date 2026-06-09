import { Types } from 'mongoose';

import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS, type PermissionName } from '@constants/permissions.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { BranchModel } from '@modules/library/library.models';

import { ShiftModel } from './shift.model';
import type { CreateShiftInput, ListShiftsQuery, UpdateShiftInput } from './shift.validation';

const toJSON = <T>(doc: unknown): T => JSON.parse(JSON.stringify(doc)) as T;

class ShiftService {
  private assert(user: AuthenticatedUser, perm: PermissionName): void {
    if (user.role === ROLES.SUPER_ADMIN) return;
    if (!user.permissions.includes(perm)) throw ApiError.forbidden('Insufficient permissions');
  }

  private scope(user: AuthenticatedUser, query: ListShiftsQuery): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (user.role === ROLES.SUPER_ADMIN) {
      if (query.libraryId) filter.libraryId = new Types.ObjectId(query.libraryId);
      if (query.branchId) filter.branchId = new Types.ObjectId(query.branchId);
      return filter;
    }
    if (!user.libraryId) throw ApiError.forbidden('Tenant library context required');
    filter.libraryId = new Types.ObjectId(user.libraryId);
    if (user.branchId) filter.branchId = new Types.ObjectId(user.branchId);
    else if (query.branchId) filter.branchId = new Types.ObjectId(query.branchId);
    return filter;
  }

  async list(user: AuthenticatedUser, query: ListShiftsQuery) {
    this.assert(user, PERMISSIONS.SHIFT_READ);
    const filter = this.scope(user, query);
    if (query.active === 'true') filter.active = true;
    if (query.active === 'false') filter.active = false;
    const items = await ShiftModel.find(filter).sort({ name: 1 }).lean();
    return items.map((i) => toJSON(i));
  }

  async getById(user: AuthenticatedUser, shiftId: string) {
    this.assert(user, PERMISSIONS.SHIFT_READ);
    const shift = await ShiftModel.findById(shiftId).lean();
    if (!shift) throw ApiError.notFound('Shift not found');
    if (user.role !== ROLES.SUPER_ADMIN && user.libraryId !== String(shift.libraryId)) {
      throw ApiError.forbidden('Access denied');
    }
    return toJSON(shift);
  }

  async create(user: AuthenticatedUser, input: CreateShiftInput) {
    this.assert(user, PERMISSIONS.SHIFT_CREATE);
    if (user.role !== ROLES.SUPER_ADMIN && user.libraryId !== input.libraryId) {
      throw ApiError.forbidden('Cannot create shift for another library');
    }
    const branch = await BranchModel.findOne({
      _id: new Types.ObjectId(input.branchId),
      libraryId: new Types.ObjectId(input.libraryId),
    });
    if (!branch) throw ApiError.badRequest('Branch not found');
    const doc = await ShiftModel.create(input);
    return toJSON(doc.toObject());
  }

  async update(user: AuthenticatedUser, shiftId: string, input: UpdateShiftInput) {
    this.assert(user, PERMISSIONS.SHIFT_UPDATE);
    const shift = await ShiftModel.findById(shiftId);
    if (!shift) throw ApiError.notFound('Shift not found');
    if (user.role !== ROLES.SUPER_ADMIN && user.libraryId !== String(shift.libraryId)) {
      throw ApiError.forbidden('Access denied');
    }
    Object.assign(shift, input);
    await shift.save();
    return toJSON(shift.toObject());
  }

  async deactivate(user: AuthenticatedUser, shiftId: string) {
    this.assert(user, PERMISSIONS.SHIFT_DELETE);
    const shift = await ShiftModel.findById(shiftId);
    if (!shift) throw ApiError.notFound('Shift not found');
    if (user.role !== ROLES.SUPER_ADMIN && user.libraryId !== String(shift.libraryId)) {
      throw ApiError.forbidden('Access denied');
    }
    shift.active = false;
    await shift.save();
    return toJSON(shift.toObject());
  }
}

export const shiftService = new ShiftService();
