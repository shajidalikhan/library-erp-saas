import { Types } from 'mongoose';

import type { AuthenticatedUser } from '@/types/express';
import { ROLES } from '@constants/roles.constants';
import { ApiError } from '@utils/ApiError';
import { lookupUserMap } from '@utils/display-enrichment.util';
import { buildPaginationMeta, resolvePagination } from '@utils/pagination';
import { ENV } from '@config/env.config';
import { logger } from '@utils/logger';
import { appendPlatformAuditLog } from '@modules/platform/platform-audit.service';
import { PlatformSettingModel } from '@modules/platform/platform-setting.model';
import { resolveDemoRequestNotifyEmail } from '@modules/platform/platform-settings.util';
import { RoleModel, UserModel } from '@modules/auth/auth.models';
import { insertInAppNotifications } from '@modules/notifications/channels/in-app.notification.service';
import { NotificationModel } from '@modules/notifications/notification.model';
import { sendDemoRequestNotificationEmail } from '@/services/email.service';

import { DEMO_REQUEST_STATUS, type DemoRequestStatus } from './demo-request.constants';
import { DemoRequestModel } from './demo-request.model';
import type {
  CreateDemoRequestInput,
  DemoRequestsListQuery,
  PatchDemoRequestInput,
} from './demo-request.validation';

void NotificationModel;

const requireSuper = (user: AuthenticatedUser) => {
  if (user.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Super admin access required');
  }
};

const toPublicItem = (doc: {
  _id: Types.ObjectId;
  fullName: string;
  email: string;
  phone: string;
  libraryName: string;
  city: string;
  branchCount: number;
  studentCount: number;
  currentSystem?: string;
  interestedFeatures: string[];
  notes?: string;
  status: string;
  assignedTo?: Types.ObjectId | null;
  statusHistory: Array<{
    status: string;
    note?: string;
    changedBy?: Types.ObjectId | null;
    createdAt: Date;
  }>;
  adminNotes: Array<{ body: string; authorId?: Types.ObjectId | null; createdAt: Date }>;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: String(doc._id),
  fullName: doc.fullName,
  email: doc.email,
  phone: doc.phone,
  libraryName: doc.libraryName,
  city: doc.city,
  branchCount: doc.branchCount,
  studentCount: doc.studentCount,
  currentSystem: doc.currentSystem ?? '',
  interestedFeatures: doc.interestedFeatures,
  notes: doc.notes ?? '',
  status: doc.status,
  assignedTo: doc.assignedTo ? String(doc.assignedTo) : null,
  statusHistory: doc.statusHistory.map((e) => ({
    status: e.status,
    note: e.note ?? '',
    changedBy: e.changedBy ? String(e.changedBy) : null,
    createdAt: e.createdAt,
  })),
  adminNotes: doc.adminNotes.map((n) => ({
    body: n.body,
    authorId: n.authorId ? String(n.authorId) : null,
    createdAt: n.createdAt,
  })),
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

type PublicDemoRequest = ReturnType<typeof toPublicItem>;

const enrichDemoRequestItems = async (items: PublicDemoRequest[]): Promise<PublicDemoRequest[]> => {
  const userIds = new Set<string>();
  for (const item of items) {
    if (item.assignedTo) userIds.add(item.assignedTo);
    for (const entry of item.statusHistory) {
      if (entry.changedBy) userIds.add(entry.changedBy);
    }
    for (const note of item.adminNotes) {
      if (note.authorId) userIds.add(note.authorId);
    }
  }
  const userMap = await lookupUserMap(
    Array.from(userIds).map((id) => new Types.ObjectId(id)),
  );
  return items.map((item) => ({
    ...item,
    assignedToName: item.assignedTo ? userMap.get(item.assignedTo)?.userName ?? null : null,
    assignedToEmail: item.assignedTo ? userMap.get(item.assignedTo)?.userEmail ?? null : null,
    statusHistory: item.statusHistory.map((entry) => ({
      ...entry,
      changedByName: entry.changedBy ? userMap.get(entry.changedBy)?.userName ?? null : null,
    })),
    adminNotes: item.adminNotes.map((note) => ({
      ...note,
      authorName: note.authorId ? userMap.get(note.authorId)?.userName ?? null : null,
    })),
  }));
};

class DemoRequestService {
  async createPublic(input: CreateDemoRequestInput): Promise<{ id: string }> {
    if (input.website) {
      throw ApiError.badRequest('Unable to submit demo request');
    }

    const recent = await DemoRequestModel.findOne({
      email: input.email,
      createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
    })
      .select('_id')
      .lean();
    if (recent) {
      throw ApiError.badRequest('A demo request was recently submitted for this email');
    }

    const created = await DemoRequestModel.create({
      ...input,
      status: DEMO_REQUEST_STATUS.NEW,
      statusHistory: [{ status: DEMO_REQUEST_STATUS.NEW, createdAt: new Date() }],
      adminNotes: [],
    });

    try {
      await appendPlatformAuditLog({
        actorUserId: null,
        action: 'DEMO_REQUEST_CREATED',
        entityType: 'DEMO_REQUEST',
        entityId: String(created._id),
        metadata: {
          email: input.email,
          libraryName: input.libraryName,
          city: input.city,
        },
      });
    } catch {
      // non-fatal
    }

    await this.notifySuperAdmins(created, input);

    return { id: String(created._id) };
  }

  private async notifySuperAdmins(
    created: { _id: Types.ObjectId; createdAt: Date },
    input: CreateDemoRequestInput,
  ): Promise<void> {
    const settings = await PlatformSettingModel.findOne({ singletonKey: 'default' }).lean();
    const notifyEmail = resolveDemoRequestNotifyEmail({
      demoRequestNotifyEmail: settings?.demoRequestNotifyEmail,
      salesEmail: settings?.salesEmail,
    });
    if (notifyEmail) {
      await sendDemoRequestNotificationEmail(notifyEmail, {
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        libraryName: input.libraryName,
        city: input.city,
        branchCount: input.branchCount,
        studentCount: input.studentCount,
        currentSystem: input.currentSystem ?? '',
        interestedFeatures: input.interestedFeatures,
        notes: input.notes ?? '',
        submittedAt: created.createdAt,
      }).catch(() => undefined);
    } else if (!ENV.SMTP_CONFIGURED && !ENV.IS_PROD) {
      logger.info(
        `[demo-request] No demo request notification email configured for lead ${created._id} (${input.libraryName})`,
      );
    }

    try {
      const superRole = await RoleModel.findOne({
        name: ROLES.SUPER_ADMIN,
        isSystem: true,
        libraryId: null,
      })
        .select('_id')
        .lean();
      if (!superRole) return;

      const recipients = await UserModel.find({ role: superRole._id, isActive: true })
        .select('_id')
        .lean();
      if (!recipients.length) return;

      const title = 'New demo request';
      const message = `${input.libraryName} requested a demo`;
      const sentAt = new Date();
      await insertInAppNotifications(
        recipients.map((user) => ({
          libraryId: null,
          branchId: null,
          recipientUserId: user._id,
          recipientRole: ROLES.SUPER_ADMIN,
          recipientType: 'USER',
          title,
          message,
          type: 'SYSTEM',
          channel: 'IN_APP',
          status: 'SENT',
          sentAt,
          metadata: {
            demoRequestId: String(created._id),
            libraryName: input.libraryName,
            email: input.email,
          },
          createdBy: null,
        })),
      );
    } catch {
      // non-fatal
    }
  }

  async listForPlatform(user: AuthenticatedUser, query: DemoRequestsListQuery) {
    requireSuper(user);
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.assignedTo) filter.assignedTo = new Types.ObjectId(query.assignedTo);
    if (query.search?.trim()) {
      const rx = new RegExp(query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { fullName: rx },
        { email: rx },
        { libraryName: rx },
        { city: rx },
        { phone: rx },
      ];
    }
    const sort: Record<string, 1 | -1> = {
      [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1,
    };
    const [items, total] = await Promise.all([
      DemoRequestModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      DemoRequestModel.countDocuments(filter),
    ]);
    return {
      items: await enrichDemoRequestItems(items.map((item) => toPublicItem(item as never))),
      meta: { pagination: buildPaginationMeta(total, page, limit) },
    };
  }

  async getForPlatform(user: AuthenticatedUser, requestId: string) {
    requireSuper(user);
    const doc = await DemoRequestModel.findById(requestId).lean();
    if (!doc) throw ApiError.notFound('Demo request not found');
    const [item] = await enrichDemoRequestItems([toPublicItem(doc as never)]);
    return item;
  }

  async patchForPlatform(
    user: AuthenticatedUser,
    requestId: string,
    body: PatchDemoRequestInput,
  ) {
    requireSuper(user);
    const doc = await DemoRequestModel.findById(requestId);
    if (!doc) throw ApiError.notFound('Demo request not found');

    if (body.assignedTo !== undefined) {
      if (body.assignedTo) {
        const assignee = await UserModel.findById(body.assignedTo).populate('role', 'name');
        if (!assignee) throw ApiError.badRequest('Assigned user not found');
        const roleName = (assignee.role as { name?: string } | null)?.name;
        if (roleName !== ROLES.SUPER_ADMIN) {
          throw ApiError.badRequest('Leads can only be assigned to super admin users');
        }
      }
      doc.assignedTo = body.assignedTo ? new Types.ObjectId(body.assignedTo) : null;
    }

    if (body.status && body.status !== doc.status) {
      const nextStatus = body.status as DemoRequestStatus;
      doc.status = nextStatus;
      doc.statusHistory.push({
        status: nextStatus,
        note: body.note,
        changedBy: new Types.ObjectId(user.id),
        createdAt: new Date(),
      });
    } else if (body.note) {
      doc.statusHistory.push({
        status: doc.status,
        note: body.note,
        changedBy: new Types.ObjectId(user.id),
        createdAt: new Date(),
      });
    }

    if (body.adminNote) {
      doc.adminNotes.push({
        body: body.adminNote,
        authorId: new Types.ObjectId(user.id),
        createdAt: new Date(),
      });
    }

    await doc.save();

    try {
      await appendPlatformAuditLog({
        actorUserId: user.id,
        action: 'DEMO_REQUEST_UPDATED',
        entityType: 'DEMO_REQUEST',
        entityId: requestId,
        metadata: {
          status: doc.status,
          assignedTo: doc.assignedTo ? String(doc.assignedTo) : null,
        },
      });
    } catch {
      // non-fatal
    }

    const [item] = await enrichDemoRequestItems([toPublicItem(doc.toObject() as never)]);
    return item;
  }
}

export const demoRequestService = new DemoRequestService();
