import crypto from 'node:crypto';
import mongoose, { type ClientSession, type SortOrder, Types } from 'mongoose';

import type { AuthenticatedUser } from '@/types/express';
import { ENV } from '@config/env.config';
import { ROLES } from '@constants/roles.constants';
import { ApiError } from '@utils/ApiError';
import { buildPaginationMeta, resolvePagination } from '@utils/pagination';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { FeePlanModel } from '@modules/payments/payments.models';
import { InvoiceModel } from '@modules/payments/invoice.model';
import { ShiftModel } from '@modules/shifts/shift.model';
import { SHIFT_ASSIGNMENT_STATUS } from '@modules/shifts/shift.constants';
import { SeatModel } from '@modules/seats/seat.model';
import { SeatAssignmentModel } from '@modules/seats/seat-assignment.model';
import { assertSeatAssignmentAllowed } from '@modules/seats/seat-occupancy.conflicts';
import { StudentModel } from '@modules/students/students.models';
import { StudentFieldConfigModel } from '@modules/students/student-field-config.model';
import { MEMBERSHIP_STATUS, MEMBERSHIP_TYPE } from '@modules/membership/membership.constants';
import { MembershipModel } from '@modules/membership/membership.model';
import { RoleModel, UserModel } from '@modules/auth/auth.models';
import { insertInAppNotifications } from '@modules/notifications/channels/in-app.notification.service';

import {
  buildPublicAvailabilityForShift,
  resolvePublicSeatCellStatus,
  toPublicSeatStatus,
} from './public-booking-availability.util';
import {
  releasePublicHoldByStaff,
  syncSeatReservationAfterHoldChange,
} from './public-booking-holds.util';
import {
  ACTIVE_PUBLIC_HOLD_STATUSES,
  PUBLIC_BOOKING_STATUS,
  PUBLIC_PAYMENT_MODE,
  PUBLIC_PAYMENT_STATUS,
} from './public-booking.constants';
import { PublicSeatBookingModel } from './public-booking.model';
import type {
  CreatePublicBookingInput,
  ListBookingsQuery,
  PublicAvailabilityQuery,
} from './public-booking.validation';

const toJSON = <T>(doc: unknown): T => JSON.parse(JSON.stringify(doc)) as T;

type PublicLibrarySettings = {
  publicPageEnabled: boolean;
  publicSlug: string;
  publicDescription?: string;
  publicPhotos: Array<{ url: string; publicId: string; caption?: string; isCover: boolean; order: number }>;
  mapLocation?: string;
  latitude?: number;
  longitude?: number;
  showPhone: boolean;
  showEmail: boolean;
  showWhatsApp: boolean;
  amenities: string[];
  rules: string[];
  bookingEnabled: boolean;
  onlinePaymentEnabled: boolean;
  offlinePaymentAllowed: boolean;
  requireOwnerApproval: boolean;
  offlineReservationMinutes: number;
  showFullSeatBreakdown: boolean;
};

function parsePublicSettings(settings: Record<string, unknown>): PublicLibrarySettings {
  const raw = (settings.publicBookingPage ?? {}) as Record<string, unknown>;
  const publicPhotos: Array<{
    url: string;
    publicId: string;
    caption?: string;
    isCover: boolean;
    order: number;
  }> = [];
  if (Array.isArray(raw.publicPhotos)) {
    raw.publicPhotos.forEach((item, index) => {
      if (typeof item === 'string') {
        publicPhotos.push({ url: item, publicId: '', caption: '', isCover: index === 0, order: index });
        return;
      }
      if (!item || typeof item !== 'object') return;
      const row = item as Record<string, unknown>;
      if (typeof row.url !== 'string') return;
      publicPhotos.push({
        url: row.url,
        publicId: typeof row.publicId === 'string' ? row.publicId : '',
        caption: typeof row.caption === 'string' ? row.caption : '',
        isCover: Boolean(row.isCover),
        order: typeof row.order === 'number' ? row.order : index,
      });
    });
    publicPhotos.sort((a, b) => a.order - b.order);
  }
  if (publicPhotos.length && !publicPhotos.some((photo) => photo.isCover)) {
    publicPhotos[0].isCover = true;
  }
  return {
    publicPageEnabled: Boolean(raw.publicPageEnabled),
    publicSlug: String(raw.publicSlug ?? '').trim().toLowerCase(),
    publicDescription: typeof raw.publicDescription === 'string' ? raw.publicDescription : undefined,
    publicPhotos,
    mapLocation: typeof raw.mapLocation === 'string' ? raw.mapLocation : undefined,
    latitude: typeof raw.latitude === 'number' ? raw.latitude : undefined,
    longitude: typeof raw.longitude === 'number' ? raw.longitude : undefined,
    showPhone: raw.showPhone !== false,
    showEmail: Boolean(raw.showEmail),
    showWhatsApp: Boolean(raw.showWhatsApp),
    amenities: Array.isArray(raw.amenities) ? raw.amenities.map((v) => String(v)) : [],
    rules: Array.isArray(raw.rules) ? raw.rules.map((v) => String(v)) : [],
    bookingEnabled: raw.bookingEnabled !== false,
    onlinePaymentEnabled: raw.onlinePaymentEnabled !== false,
    offlinePaymentAllowed: raw.offlinePaymentAllowed !== false,
    requireOwnerApproval: raw.requireOwnerApproval !== false,
    offlineReservationMinutes:
      typeof raw.offlineReservationMinutes === 'number' && raw.offlineReservationMinutes > 0
        ? raw.offlineReservationMinutes
        : 180,
    showFullSeatBreakdown: Boolean(raw.showFullSeatBreakdown),
  };
}

async function resolvePublicLibraryBySlug(slug: string) {
  const library = await LibraryModel.findOne({
    $or: [{ slug: slug.toLowerCase() }, { 'settings.publicBookingPage.publicSlug': slug.toLowerCase() }],
  }).lean();
  if (!library) throw ApiError.notFound('Library public page not found');
  const publicSettings = parsePublicSettings((library.settings ?? {}) as Record<string, unknown>);
  if (!publicSettings.publicPageEnabled) throw ApiError.notFound('Library public page is disabled');
  return { library, publicSettings };
}

async function cleanupExpiredBookings(libraryId: Types.ObjectId): Promise<void> {
  const expiredRows = await PublicSeatBookingModel.find({
    libraryId,
    bookingStatus: PUBLIC_BOOKING_STATUS.HOLD,
    expiresAt: { $lte: new Date() },
  })
    .select('_id seatId')
    .lean();
  if (!expiredRows.length) return;
  const bookingIds = expiredRows.map((row) => row._id);
  const seatIds = expiredRows.map((row) => row.seatId);
  await PublicSeatBookingModel.updateMany(
    { _id: { $in: bookingIds } },
    { $set: { bookingStatus: PUBLIC_BOOKING_STATUS.EXPIRED } },
  );
  for (const seatId of seatIds) {
    await syncSeatReservationAfterHoldChange(seatId as Types.ObjectId);
  }
}

async function reserveSeatForPublicBooking(input: {
  libraryId: Types.ObjectId;
  branchId: Types.ObjectId;
  shiftId: Types.ObjectId;
  seatId: Types.ObjectId;
  expiresAt: Date;
}): Promise<void> {
  const seat = await SeatModel.findOne({
    _id: input.seatId,
    libraryId: input.libraryId,
    branchId: input.branchId,
  });
  if (!seat) throw ApiError.notFound('Seat not found');
  if (!seat.active) throw ApiError.badRequest('Seat is inactive');
  if (seat.status === 'BLOCKED' || seat.status === 'MAINTENANCE') {
    throw ApiError.conflict('Seat is unavailable');
  }
  seat.status = 'RESERVED';
  seat.reservedUntil = input.expiresAt;
  await seat.save();
}

function requireLibraryContext(user: AuthenticatedUser): string {
  if (!user.libraryId) throw ApiError.forbidden('Tenant library context required');
  return user.libraryId;
}

const BRANCH_SCOPED_ROLES = new Set<string>([
  ROLES.MANAGER,
  ROLES.RECEPTIONIST,
  ROLES.SECURITY,
  ROLES.ACCOUNTANT,
]);

function resolveScopedLibraryId(user: AuthenticatedUser, requestedLibraryId?: string): string | null {
  if (user.role === ROLES.SUPER_ADMIN) {
    return requestedLibraryId?.trim() || null;
  }
  return requireLibraryContext(user);
}

function applyBranchScope(
  user: AuthenticatedUser,
  filter: Record<string, unknown>,
  queryBranchId?: string,
): void {
  if (user.branchId && BRANCH_SCOPED_ROLES.has(user.role)) {
    filter.branchId = new Types.ObjectId(user.branchId);
    return;
  }
  if (queryBranchId) {
    filter.branchId = new Types.ObjectId(queryBranchId);
  }
}

async function notifyPublicBookingEvent(args: {
  libraryId: Types.ObjectId;
  branchId: Types.ObjectId;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  const roles = await RoleModel.find({
    name: { $in: [ROLES.LIBRARY_OWNER, ROLES.MANAGER, ROLES.RECEPTIONIST] },
  })
    .select('_id')
    .lean();
  if (!roles.length) return;
  const roleIds = roles.map((role) => role._id);
  const recipients = await UserModel.find({
    libraryId: args.libraryId,
    isActive: true,
    status: 'ACTIVE',
    role: { $in: roleIds },
    'notificationPreferences.inAppEnabled': { $ne: false },
  })
    .select('_id role branchId')
    .lean();
  if (!recipients.length) return;
  const now = new Date();
  await insertInAppNotifications(
    recipients.map((recipient) => ({
      libraryId: args.libraryId,
      branchId: recipient.branchId ?? args.branchId,
      recipientUserId: recipient._id,
      recipientRole: null,
      recipientType: 'ROLE',
      title: args.title,
      message: args.message,
      type: 'SYSTEM',
      channel: 'IN_APP',
      status: 'SENT',
      sentAt: now,
      metadata: args.metadata,
      createdBy: null,
    })),
  );
}

function mapShiftToMembershipType(kind: string): string {
  if (kind === 'MORNING') return MEMBERSHIP_TYPE.MORNING;
  if (kind === 'AFTERNOON') return MEMBERSHIP_TYPE.AFTERNOON;
  if (kind === 'EVENING') return MEMBERSHIP_TYPE.EVENING;
  if (kind === 'NIGHT') return MEMBERSHIP_TYPE.NIGHT;
  if (kind === 'FULL_DAY') return MEMBERSHIP_TYPE.FULL_DAY;
  return MEMBERSHIP_TYPE.CUSTOM_SHIFT;
}

function makeBookingReference(): string {
  return `PB-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

async function allocateStudentId(libraryId: Types.ObjectId): Promise<string> {
  for (let i = 0; i < 12; i += 1) {
    const studentId = `STU-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const exists = await StudentModel.exists({ libraryId, studentId });
    if (!exists) return studentId;
  }
  throw ApiError.internal('Unable to allocate student ID');
}

async function allocateDocNumber(libraryId: Types.ObjectId, session?: ClientSession): Promise<string> {
  for (let i = 0; i < 12; i += 1) {
    const candidate = `INV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const exists = await InvoiceModel.exists({ libraryId, invoiceNumber: candidate }).session(session ?? null);
    if (!exists) return candidate;
  }
  throw ApiError.internal('Unable to allocate invoice number');
}

async function runWithOptionalTransaction<T>(work: (session?: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    if (result === undefined) throw ApiError.internal('Transaction failed to produce result');
    return result;
  } catch (error) {
    const msg = String((error as Error)?.message ?? '');
    const unsupported =
      msg.includes('Transaction numbers are only allowed') ||
      msg.includes('replica set') ||
      msg.includes('does not support retryable writes');
    if (unsupported) {
      return work(undefined);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

class PublicBookingService {
  async getPublicLibraryProfile(slug: string) {
    const { library, publicSettings } = await resolvePublicLibraryBySlug(slug);
    const libraryId = library._id as Types.ObjectId;
    await cleanupExpiredBookings(libraryId);

    const [branches, shifts, feePlans, seatSummary, seats, activeAssignments, publicBookings] =
      await Promise.all([
        BranchModel.find({ libraryId, active: true }).select('branchName city address phone').lean(),
        ShiftModel.find({ libraryId, active: true })
          .select('branchId name startTime endTime type color')
          .sort({ startTime: 1 })
          .lean(),
        FeePlanModel.find({ libraryId, active: true })
          .select('branchId name type amount durationDays shiftId')
          .lean(),
        SeatModel.aggregate<{ _id: string; count: number }>([
          { $match: { libraryId, active: true } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        SeatModel.find({ libraryId, active: true })
          .select('branchId status active')
          .lean(),
        SeatAssignmentModel.find({
          libraryId,
          status: { $in: [SHIFT_ASSIGNMENT_STATUS.ACTIVE, SHIFT_ASSIGNMENT_STATUS.RESERVED] },
        })
          .select('seatId shiftId')
          .populate('shiftId', 'type startTime endTime')
          .lean(),
        PublicSeatBookingModel.find({
          libraryId,
          bookingStatus: { $in: [...ACTIVE_PUBLIC_HOLD_STATUSES] },
          expiresAt: { $gt: new Date() },
        })
          .select('seatId shiftId')
          .lean(),
      ]);

    const summary = {
      AVAILABLE: 0,
      OCCUPIED: 0,
      RESERVED: 0,
      BLOCKED: 0,
    };
    for (const row of seatSummary) {
      if (row._id in summary) summary[row._id as keyof typeof summary] = row.count;
    }

    const shiftStats = shifts.map(
      (s: { _id: Types.ObjectId; branchId: Types.ObjectId; name: string; startTime: string; endTime: string; type: string }) => {
        const { availableCount } = buildPublicAvailabilityForShift({
          shift: s,
          seats,
          assignments: activeAssignments,
          publicBookings,
        });
        const plans = feePlans.filter(
          (p: { branchId: Types.ObjectId; shiftId?: Types.ObjectId | null }) =>
            String(p.branchId) === String(s.branchId) &&
            (!p.shiftId || String(p.shiftId) === String(s._id)),
        );
        let cheapest: { amount: number; durationDays: number } | null = null;
        for (const plan of plans) {
          if (!cheapest || plan.amount < cheapest.amount) {
            cheapest = { amount: plan.amount, durationDays: plan.durationDays };
          }
        }
        return {
          shiftId: String(s._id),
          branchId: String(s.branchId),
          availableSeats: availableCount,
          startingPrice: cheapest?.amount ?? null,
          startingDurationDays: cheapest?.durationDays ?? null,
          planCount: plans.length,
        };
      },
    );

    return {
      library: {
        id: String(library._id),
        name: library.name,
        slug: publicSettings.publicSlug || library.slug,
        description: publicSettings.publicDescription ?? '',
        logo: library.logo ?? null,
        coverPhotos: publicSettings.publicPhotos,
        address: library.address ?? '',
        city: library.city ?? '',
        phone: publicSettings.showPhone ? library.phone ?? '' : '',
        email: publicSettings.showEmail ? library.email : '',
        whatsapp: publicSettings.showWhatsApp ? library.phone ?? '' : '',
        mapLocation: publicSettings.mapLocation ?? '',
        latitude: publicSettings.latitude ?? null,
        longitude: publicSettings.longitude ?? null,
        amenities: publicSettings.amenities,
        rules: publicSettings.rules,
      },
      branches: branches.map((b: { _id: Types.ObjectId; branchName: string; city?: string; address?: string; phone?: string }) => ({
        _id: String(b._id),
        branchName: b.branchName,
        city: b.city ?? '',
        address: b.address ?? '',
        phone: publicSettings.showPhone ? b.phone ?? '' : '',
      })),
      shifts: shifts.map((s: { _id: Types.ObjectId; branchId: Types.ObjectId; name: string; startTime: string; endTime: string; type: string; color: string }) => ({
        _id: String(s._id),
        branchId: String(s.branchId),
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        type: s.type,
        color: s.color,
      })),
      feePlans: feePlans.map((p: { _id: Types.ObjectId; branchId: Types.ObjectId; name: string; type: string; amount: number; durationDays: number; shiftId?: Types.ObjectId | null }) => ({
        _id: String(p._id),
        branchId: String(p.branchId),
        name: p.name,
        type: p.type,
        amount: p.amount,
        durationDays: p.durationDays,
        shiftId: p.shiftId ? String(p.shiftId) : null,
      })),
      booking: { enabled: publicSettings.bookingEnabled, holdHours: ENV.PUBLIC_BOOKING_HOLD_HOURS },
      publicBookingSettings: {
        showFullSeatBreakdown: publicSettings.showFullSeatBreakdown,
      },
      shiftStats,
      seatAvailabilitySummary: summary,
      publicStudentFields: await StudentFieldConfigModel.find({ libraryId, active: true })
        .select('fieldKey label type required options order')
        .sort({ order: 1, createdAt: 1 })
        .lean(),
    };
  }

  async getPublicAvailability(slug: string, query: PublicAvailabilityQuery) {
    const { library, publicSettings } = await resolvePublicLibraryBySlug(slug);
    const libraryId = library._id as Types.ObjectId;
    const branchId = new Types.ObjectId(query.branchId);
    const shiftId = new Types.ObjectId(query.shiftId);

    await cleanupExpiredBookings(libraryId);

    const [shift, seats, activeAssignments, publicBookings] = await Promise.all([
      ShiftModel.findOne({ _id: shiftId, libraryId, branchId, active: true }).lean(),
      SeatModel.find({ libraryId, branchId, active: true })
        .select('seatNumber floor zone status reservedUntil')
        .sort({ floor: 1, zone: 1, seatNumber: 1 })
        .lean(),
      SeatAssignmentModel.find({
        libraryId,
        branchId,
        status: { $in: [SHIFT_ASSIGNMENT_STATUS.ACTIVE, SHIFT_ASSIGNMENT_STATUS.RESERVED] },
      })
        .select('seatId shiftId')
        .populate('shiftId', 'type startTime endTime')
        .lean(),
      PublicSeatBookingModel.find({
        libraryId,
        branchId,
        bookingStatus: { $in: [...ACTIVE_PUBLIC_HOLD_STATUSES] },
        expiresAt: { $gt: new Date() },
      })
        .select('seatId shiftId')
        .lean(),
    ]);

    if (!shift) throw ApiError.badRequest('Shift not found for this branch');

    const publicBlocked = new Set(
      publicBookings
        .filter((b) => String(b.shiftId) === String(shiftId))
        .map((b) => String(b.seatId)),
    );

    const items = seats.map((seat) => {
      const assignmentRows = activeAssignments.filter((a) => String(a.seatId) === String(seat._id));
      const cellStatus = resolvePublicSeatCellStatus(
        seat,
        shift,
        assignmentRows,
        publicBlocked.has(String(seat._id)),
      );
      return {
        _id: String(seat._id),
        seatNumber: seat.seatNumber,
        floor: seat.floor,
        zone: seat.zone,
        status: toPublicSeatStatus(cellStatus, publicSettings.showFullSeatBreakdown),
      };
    });

    return {
      branchId: String(branchId),
      shiftId: String(shiftId),
      seats: items,
    };
  }

  async createPublicBooking(slug: string, input: CreatePublicBookingInput) {
    const { library, publicSettings } = await resolvePublicLibraryBySlug(slug);
    if (!publicSettings.bookingEnabled) throw ApiError.badRequest('Public booking is disabled');
    if (!publicSettings.offlinePaymentAllowed) {
      throw ApiError.badRequest('Offline payments are disabled');
    }

    const libraryId = library._id as Types.ObjectId;
    await cleanupExpiredBookings(libraryId);

    const branchId = new Types.ObjectId(input.branchId);
    const shiftId = new Types.ObjectId(input.shiftId);
    const seatId = new Types.ObjectId(input.seatId);
    const feePlanId = new Types.ObjectId(input.feePlanId);

    const [branch, shift, seat, feePlan] = await Promise.all([
      BranchModel.findOne({ _id: branchId, libraryId, active: true }).lean(),
      ShiftModel.findOne({ _id: shiftId, libraryId, branchId, active: true }).lean(),
      SeatModel.findOne({ _id: seatId, libraryId, branchId }).lean(),
      FeePlanModel.findOne({ _id: feePlanId, libraryId, branchId, active: true }).lean(),
    ]);

    if (!branch) throw ApiError.badRequest('Branch not found');
    if (!shift) throw ApiError.badRequest('Shift not found');
    if (!seat) throw ApiError.badRequest('Seat not found');
    if (!feePlan) throw ApiError.badRequest('Fee plan not found');

    const bookingConflict = await PublicSeatBookingModel.exists({
      libraryId,
      seatId,
      shiftId,
      bookingStatus: { $in: [PUBLIC_BOOKING_STATUS.HOLD, PUBLIC_BOOKING_STATUS.APPROVED] },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    });
    if (bookingConflict) throw ApiError.conflict('Seat already booked for this shift');

    await assertSeatAssignmentAllowed(seatId, {
      _id: shiftId,
      type: shift.type,
      startTime: shift.startTime,
      endTime: shift.endTime,
    });

    const holdHours = ENV.PUBLIC_BOOKING_HOLD_HOURS;
    const expiresAt = new Date(Date.now() + holdHours * 60 * 60 * 1000);
    const bookingReference = makeBookingReference();

    const booking = await PublicSeatBookingModel.create({
      libraryId,
      branchId,
      shiftId,
      seatId,
      feePlanId,
      bookingReference,
      selectedSeatNumber: seat.seatNumber,
      selectedShiftName: shift.name,
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      guardianName: input.guardianName,
      guardianPhone: input.guardianPhone,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      amount: feePlan.amount,
      paymentMode: PUBLIC_PAYMENT_MODE.OFFLINE,
      paymentStatus: PUBLIC_PAYMENT_STATUS.PENDING_OFFLINE,
      bookingStatus: PUBLIC_BOOKING_STATUS.HOLD,
      expiresAt,
      notes: input.notes,
      address: input.address,
      customFields: input.customFields ?? {},
    });

    await reserveSeatForPublicBooking({ libraryId, branchId, shiftId, seatId, expiresAt });

    await notifyPublicBookingEvent({
      libraryId,
      branchId,
      title: 'New public booking hold',
      message: `${input.fullName} placed a hold for seat ${seat.seatNumber} (${shift.name}).`,
      metadata: {
        source: 'PUBLIC_BOOKING',
        event: 'BOOKING_HOLD_CREATED',
        bookingId: String(booking._id),
        bookingReference,
        seatNumber: seat.seatNumber,
        shiftName: shift.name,
      },
    });

    return {
      booking: toJSON(booking.toObject()),
      message:
        'Your selected seat is held for 3 hours. Please visit the library to complete admission and payment.',
      hold: {
        bookingReference,
        seatNumber: seat.seatNumber,
        shiftName: shift.name,
        expiresAt,
        contactPhone: publicSettings.showPhone ? library.phone ?? '' : '',
      },
    };
  }

  async listOwnerBookings(user: AuthenticatedUser, query: ListBookingsQuery) {
    const libraryId = resolveScopedLibraryId(user, query.libraryId);
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });

    if (!libraryId) {
      return {
        items: [],
        meta: { pagination: buildPaginationMeta(0, page, limit) },
      };
    }

    const filter: Record<string, unknown> = { libraryId: new Types.ObjectId(libraryId) };
    applyBranchScope(user, filter, query.branchId);
    if (query.bookingStatus) filter.bookingStatus = query.bookingStatus;
    if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
    if (query.shiftId) filter.shiftId = new Types.ObjectId(query.shiftId);
    if (query.fromDate || query.toDate) {
      filter.createdAt = {};
      if (query.fromDate) (filter.createdAt as Record<string, Date>).$gte = query.fromDate;
      if (query.toDate) (filter.createdAt as Record<string, Date>).$lte = query.toDate;
    }
    if (query.search) {
      const rx = new RegExp(query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ fullName: rx }, { phone: rx }, { email: rx }, { bookingReference: rx }];
    }

    const [items, total] = await Promise.all([
      PublicSeatBookingModel.find(filter)
        .sort({ createdAt: -1 as SortOrder })
        .skip(skip)
        .limit(limit)
        .populate('branchId', 'branchName')
        .populate('shiftId', 'name')
        .populate('seatId', 'seatNumber floor zone')
        .populate('feePlanId', 'name amount durationDays')
        .lean(),
      PublicSeatBookingModel.countDocuments(filter),
    ]);

    return {
      items: items.map((row) => toJSON(row)),
      meta: { pagination: buildPaginationMeta(total, page, limit) },
    };
  }

  async getBookingByIdForOwner(user: AuthenticatedUser, bookingId: string, libraryIdHint?: string) {
    const match: Record<string, unknown> = { _id: new Types.ObjectId(bookingId) };
    if (user.role === ROLES.SUPER_ADMIN) {
      if (libraryIdHint) {
        match.libraryId = new Types.ObjectId(libraryIdHint);
      }
    } else {
      const libraryId = requireLibraryContext(user);
      if (libraryIdHint && libraryIdHint !== libraryId) {
        throw ApiError.forbidden('Invalid library scope');
      }
      match.libraryId = new Types.ObjectId(libraryId);
    }
    const row = await PublicSeatBookingModel.findOne(match)
      .populate('branchId', 'branchName')
      .populate('shiftId', 'name startTime endTime type')
      .populate('seatId', 'seatNumber floor zone')
      .populate('feePlanId', 'name amount durationDays')
      .lean();
    if (!row) throw ApiError.notFound('Booking not found');
    if (user.branchId && BRANCH_SCOPED_ROLES.has(user.role)) {
      const rowBranchId =
        typeof row.branchId === 'object' && row.branchId !== null && '_id' in row.branchId
          ? String((row.branchId as { _id: Types.ObjectId })._id)
          : String(row.branchId);
      if (rowBranchId !== user.branchId) {
        throw ApiError.forbidden('Booking not in your branch');
      }
    }
    return toJSON(row);
  }

  async approveBooking(user: AuthenticatedUser, bookingId: string) {
    const booking = await this.getBookingByIdForOwner(user, bookingId);
    const doc = await PublicSeatBookingModel.findById(bookingId);
    if (!doc) throw ApiError.notFound('Booking not found');
    if (doc.bookingStatus === PUBLIC_BOOKING_STATUS.EXPIRED) {
      throw ApiError.conflict('Booking has expired');
    }
    doc.bookingStatus = PUBLIC_BOOKING_STATUS.APPROVED;
    await doc.save();
    return booking;
  }

  async rejectBooking(user: AuthenticatedUser, bookingId: string, reason?: string) {
    await this.getBookingByIdForOwner(user, bookingId);
    const doc = await PublicSeatBookingModel.findById(bookingId);
    if (!doc) throw ApiError.notFound('Booking not found');
    doc.bookingStatus = PUBLIC_BOOKING_STATUS.REJECTED;
    doc.notes = reason ? `${doc.notes ?? ''}\nRejected: ${reason}`.trim() : doc.notes;
    await doc.save();
    await syncSeatReservationAfterHoldChange(doc.seatId as Types.ObjectId);
    return toJSON(doc.toObject());
  }

  async releaseHoldByStaff(user: AuthenticatedUser, bookingId: string, note?: string) {
    return releasePublicHoldByStaff(user, bookingId, note);
  }

  async convertToStudent(user: AuthenticatedUser, bookingId: string) {
    return runWithOptionalTransaction(async (session) => {
      const booking = await PublicSeatBookingModel.findById(bookingId).session(session ?? null);
      if (!booking) throw ApiError.notFound('Booking not found');
      const libraryId = requireLibraryContext(user);
      if (String(booking.libraryId) !== libraryId) throw ApiError.forbidden('Access denied');
      if (user.branchId && BRANCH_SCOPED_ROLES.has(user.role) && String(booking.branchId) !== user.branchId) {
        throw ApiError.forbidden('Booking not in your branch');
      }
      if (
        booking.bookingStatus === PUBLIC_BOOKING_STATUS.EXPIRED ||
        booking.bookingStatus === PUBLIC_BOOKING_STATUS.REJECTED
      ) {
        throw ApiError.conflict('Expired or cancelled bookings cannot be converted');
      }
      if (
        booking.bookingStatus !== PUBLIC_BOOKING_STATUS.HOLD &&
        booking.bookingStatus !== PUBLIC_BOOKING_STATUS.APPROVED
      ) {
        throw ApiError.conflict('Booking must be active hold or approved before conversion');
      }
      if (booking.convertedStudentId || booking.convertedAt) {
        throw ApiError.conflict('Booking already converted');
      }

      const [shift, feePlan, seat] = await Promise.all([
        ShiftModel.findOne({ _id: booking.shiftId, libraryId: booking.libraryId, branchId: booking.branchId })
          .session(session ?? null)
          .lean(),
        FeePlanModel.findOne({ _id: booking.feePlanId, libraryId: booking.libraryId, branchId: booking.branchId })
          .session(session ?? null)
          .lean(),
        SeatModel.findOne({ _id: booking.seatId, libraryId: booking.libraryId, branchId: booking.branchId }).session(
          session ?? null,
        ),
      ]);
      if (!shift || !feePlan || !seat) throw ApiError.badRequest('Booking references missing records');

      const studentId = await allocateStudentId(booking.libraryId as Types.ObjectId);
      const now = new Date();
      const membershipEnd = new Date(now.getTime() + feePlan.durationDays * 24 * 60 * 60 * 1000);

      const student = await StudentModel.create(
        [
          {
            libraryId: booking.libraryId,
            branchId: booking.branchId,
            studentId,
            fullName: booking.fullName,
            email: booking.email || `${studentId.toLowerCase()}@placeholder.local`,
            phone: booking.phone,
            guardianPhone: booking.guardianPhone,
            address: booking.address,
            gender: 'UNSPECIFIED',
            admissionDate: now,
            membershipStartDate: now,
            membershipEndDate: membershipEnd,
            status: 'ACTIVE',
            assignedSeatId: booking.seatId,
            currentShiftId: booking.shiftId,
            userId: null,
          },
        ],
        { session },
      );
      const studentDoc = student[0];

      const membership = await MembershipModel.create(
        [
          {
            studentId: studentDoc._id,
            libraryId: booking.libraryId,
            branchId: booking.branchId,
            shiftId: booking.shiftId,
            seatId: booking.seatId,
            membershipType: mapShiftToMembershipType(shift.type),
            startDate: now,
            endDate: membershipEnd,
            durationDays: feePlan.durationDays,
            status: MEMBERSHIP_STATUS.ACTIVE,
            feePlanId: booking.feePlanId,
            invoiceId: null,
            paymentId: null,
          },
        ],
        { session },
      );
      const membershipDoc = membership[0];

      await SeatAssignmentModel.updateMany(
        {
          seatId: booking.seatId,
          shiftId: booking.shiftId,
          status: { $in: [SHIFT_ASSIGNMENT_STATUS.ACTIVE, SHIFT_ASSIGNMENT_STATUS.RESERVED] },
        },
        { $set: { status: SHIFT_ASSIGNMENT_STATUS.CANCELLED } },
        { session },
      );

      const seatAssignmentRows = await SeatAssignmentModel.create(
        [
          {
            libraryId: booking.libraryId,
            branchId: booking.branchId,
            seatId: booking.seatId,
            studentId: studentDoc._id,
            shiftId: booking.shiftId,
            membershipId: membershipDoc._id,
            startDate: now,
            endDate: membershipEnd,
            status: SHIFT_ASSIGNMENT_STATUS.ACTIVE,
            assignedBy: new Types.ObjectId(user.id),
          },
        ],
        { session },
      );
      const seatAssignment = seatAssignmentRows[0];

      seat.assignedStudentId = studentDoc._id as Types.ObjectId;
      seat.occupied = true;
      seat.status = 'OCCUPIED';
      seat.reservedUntil = null;
      await seat.save({ session });

      const invoiceNumber = await allocateDocNumber(booking.libraryId as Types.ObjectId, session);
      const invoiceRows = await InvoiceModel.create(
        [
          {
            libraryId: booking.libraryId,
            branchId: booking.branchId,
            studentId: studentDoc._id,
            seatId: booking.seatId,
            feePlanId: booking.feePlanId,
            invoiceNumber,
            amount: booking.amount,
            discountAmount: 0,
            taxAmount: 0,
            totalAmount: booking.amount,
            paidAmount: 0,
            refundTotal: 0,
            dueAmount: booking.amount,
            status: 'UNPAID',
            dueDate: now,
            notes: 'Converted from public booking',
            membershipPeriodStart: now,
            membershipPeriodEnd: membershipEnd,
            currency: 'INR',
          },
        ],
        { session },
      );
      const invoice = invoiceRows[0];

      let payment: Record<string, unknown> | null = null;

      membershipDoc.invoiceId = invoice._id as Types.ObjectId;
      await membershipDoc.save({ session });

      booking.notes = `Converted to student ${studentId}`;
      booking.convertedAt = now;
      booking.convertedStudentId = studentDoc._id as Types.ObjectId;
      booking.bookingStatus = PUBLIC_BOOKING_STATUS.CONVERTED;
      booking.paymentStatus = PUBLIC_PAYMENT_STATUS.NOT_REQUIRED;
      booking.expiresAt = null;
      await booking.save({ session });

      return {
        booking: toJSON(booking.toObject()),
        student: toJSON(studentDoc.toObject()),
        membership: toJSON(membershipDoc.toObject()),
        seatAssignment: toJSON(seatAssignment.toObject()),
        invoice: toJSON(invoice.toObject()),
        payment,
      };
    });
  }

  async getAdmissionPrefill(user: AuthenticatedUser, bookingId: string) {
    const booking = (await this.getBookingByIdForOwner(user, bookingId)) as Record<string, unknown>;
    const branchId =
      typeof booking.branchId === 'string'
        ? booking.branchId
        : String(((booking.branchId ?? {}) as { _id?: Types.ObjectId })._id ?? '');
    const shiftId =
      typeof booking.shiftId === 'string'
        ? booking.shiftId
        : String(((booking.shiftId ?? {}) as { _id?: Types.ObjectId })._id ?? '');
    const seatId =
      typeof booking.seatId === 'string'
        ? booking.seatId
        : String(((booking.seatId ?? {}) as { _id?: Types.ObjectId })._id ?? '');
    return {
      bookingId: String(booking._id ?? ''),
      bookingReference: String(booking.bookingReference ?? ''),
      branchId,
      shiftId,
      seatId,
      fullName: String(booking.fullName ?? ''),
      phone: String(booking.phone ?? ''),
      email: String(booking.email ?? ''),
      guardianName: String(booking.guardianName ?? ''),
      guardianPhone: String(booking.guardianPhone ?? ''),
      address: String(booking.address ?? ''),
      city: String(booking.city ?? ''),
      state: String(booking.state ?? ''),
      pincode: String(booking.pincode ?? ''),
      notes: String(booking.notes ?? ''),
      customFields: (booking.customFields as Record<string, unknown>) ?? {},
    };
  }
}

export const publicBookingService = new PublicBookingService();

export async function expirePublicSeatHolds(): Promise<number> {
  const expired = await PublicSeatBookingModel.find({
    bookingStatus: PUBLIC_BOOKING_STATUS.HOLD,
    expiresAt: { $lte: new Date() },
  })
    .select('_id seatId')
    .lean();
  if (!expired.length) return 0;
  const ids = expired.map((row) => row._id);
  const seatIds = expired.map((row) => row.seatId);
  await PublicSeatBookingModel.updateMany(
    { _id: { $in: ids }, bookingStatus: PUBLIC_BOOKING_STATUS.HOLD },
    { $set: { bookingStatus: PUBLIC_BOOKING_STATUS.EXPIRED } },
  );
  await SeatModel.updateMany(
    { _id: { $in: seatIds }, status: 'RESERVED' },
    { $set: { status: 'AVAILABLE', reservedUntil: null } },
  );
  const first = expired[0];
  if (first) {
    const firstBooking = await PublicSeatBookingModel.findById(first._id)
      .select('libraryId branchId bookingReference')
      .lean();
    if (firstBooking) {
      await notifyPublicBookingEvent({
        libraryId: firstBooking.libraryId as Types.ObjectId,
        branchId: firstBooking.branchId as Types.ObjectId,
        title: 'Public booking hold expired',
        message: `${ids.length} public seat hold(s) expired and were released.`,
        metadata: {
          source: 'PUBLIC_BOOKING',
          event: 'BOOKING_HOLD_EXPIRED',
          expiredCount: ids.length,
        },
      });
    }
  }
  return ids.length;
}
