import { Types, type PipelineStage } from 'mongoose';

import { PERMISSIONS } from '@constants/permissions.constants';
import { ROLES } from '@constants/roles.constants';
import type { RoleName } from '@constants/roles.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { enrichRowsWithLookups } from '@utils/display-enrichment.util';
import { buildPaginationMeta, resolvePagination } from '@utils/pagination';
import { RoleModel, UserModel } from '@modules/auth/auth.models';
import { BranchModel, LibraryModel } from '@modules/library/library.models';

import { insertInAppNotifications } from './channels/in-app.notification.service';
import { sendEmailNotificationStub } from './channels/email.notification.stub';
import { sendSmsNotificationStub } from './channels/sms.notification.stub';
import { sendWhatsappNotificationStub } from './channels/whatsapp.notification.stub';
import { NotificationLogModel } from './notification-log.model';
import { NotificationModel } from './notification.model';
import { NotificationTemplateModel } from './notification-template.model';
import type { NotificationType } from './notifications.constants';
import { NOTIFICATION_TYPES } from './notifications.constants';
import { logActivity } from '@modules/activity/activity-audit.service';
import { applyExcludeSelf, resolveRecipientUserIds } from './notifications.recipients';
import { buildRecipientRows, defaultStatusBreakdown } from './notifications.snapshot-helpers';
import type {
  BulkSendBody,
  CreateTemplateBody,
  LogsListQuery,
  NotificationListQuery,
  RecipientsListQuery,
  SendNotificationBody,
  TemplateListQuery,
  UpdateTemplateBody,
} from './notifications.validation';

type NotificationTypeEnum = (typeof NOTIFICATION_TYPES)[number];

function userCan(user: AuthenticatedUser, p: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]): boolean {
  if (user.role === ROLES.SUPER_ADMIN) return true;
  return user.permissions.includes(p);
}

type SendTarget = SendNotificationBody['target'];

function assertSendTargetMode(role: RoleName, target: SendTarget): void {
  if (target.mode === 'PLATFORM') {
    if (role !== ROLES.SUPER_ADMIN) {
      throw ApiError.forbidden('Platform audience is restricted to super admins');
    }
    return;
  }
  if (role === ROLES.SUPER_ADMIN || role === ROLES.LIBRARY_OWNER) return;
  if (role === ROLES.MANAGER) return;
  if (role === ROLES.ACCOUNTANT) {
    if (target.mode !== 'USER' && target.mode !== 'STUDENTS_WITH_DUES') {
      throw ApiError.forbidden('Accountants may only notify a specific user or students with dues');
    }
    return;
  }
  if (role === ROLES.RECEPTIONIST) {
    if (
      target.mode === 'LIBRARY' ||
      target.mode === 'ROLE' ||
      target.mode === 'STUDENTS_WITH_DUES'
    ) {
      throw ApiError.forbidden('This audience target is not available for receptionists');
    }
    return;
  }
  throw ApiError.forbidden('Cannot send notifications');
}

function assertNotificationTypeAllowed(role: RoleName, type: NotificationTypeEnum): void {
  if (role === ROLES.SUPER_ADMIN) return;
  if (role === ROLES.LIBRARY_OWNER) return;
  if (role === ROLES.MANAGER) {
    if (type === 'SYSTEM') throw ApiError.forbidden('Managers cannot send SYSTEM notifications');
    return;
  }
  if (role === ROLES.ACCOUNTANT) {
    if (!['PAYMENT_DUE', 'PAYMENT_OVERDUE'].includes(type)) {
      throw ApiError.forbidden('Accountants may only send payment reminder notifications');
    }
    return;
  }
  if (role === ROLES.RECEPTIONIST) {
    if (['PAYMENT_DUE', 'PAYMENT_OVERDUE', 'SYSTEM'].includes(type)) {
      throw ApiError.forbidden('This notification type is not available for receptionists');
    }
    return;
  }
  throw ApiError.forbidden('Cannot send notifications');
}

function resolveLibraryOidForSend(
  user: AuthenticatedUser,
  bodyLibraryId: string | undefined,
  target: SendTarget,
): Types.ObjectId | null {
  if (target.mode === 'PLATFORM') {
    if (user.role !== ROLES.SUPER_ADMIN) throw ApiError.forbidden('Invalid audience');
    return null;
  }
  if (user.role === ROLES.SUPER_ADMIN) {
    if (!bodyLibraryId) throw ApiError.badRequest('libraryId is required');
    return new Types.ObjectId(bodyLibraryId);
  }
  if (!user.libraryId) throw ApiError.forbidden('Library context required');
  if (bodyLibraryId && bodyLibraryId !== user.libraryId) throw ApiError.forbidden('Invalid library');
  return new Types.ObjectId(user.libraryId);
}

function effectiveBranchFilter(
  user: AuthenticatedUser,
  bodyBranchId?: string,
): { branchOid: Types.ObjectId | null; senderBranchId: string | null } {
  if (user.role === ROLES.MANAGER) {
    if (!user.branchId) throw ApiError.forbidden('Branch context required');
    if (bodyBranchId && bodyBranchId !== user.branchId) throw ApiError.forbidden('Invalid branch');
    return { branchOid: new Types.ObjectId(user.branchId), senderBranchId: user.branchId };
  }
  if (bodyBranchId) return { branchOid: new Types.ObjectId(bodyBranchId), senderBranchId: null };
  if (user.branchId) return { branchOid: new Types.ObjectId(user.branchId), senderBranchId: null };
  return { branchOid: null, senderBranchId: null };
}

async function applyTemplate(
  libraryId: Types.ObjectId | null,
  templateId: string | undefined,
  vars: Record<string, string> | undefined,
  title: string,
  message: string,
): Promise<{ title: string; message: string }> {
  if (!templateId) return { title, message };
  const q: Record<string, unknown> = { _id: new Types.ObjectId(templateId), active: true };
  if (libraryId) {
    q.libraryId = libraryId;
  } else {
    q.$or = [{ libraryId: null }, { libraryId: { $exists: false } }];
  }
  const tpl = await NotificationTemplateModel.findOne(q).lean();
  if (!tpl) throw ApiError.badRequest('Template not found');
  let outTitle = tpl.subject || title;
  let outBody = tpl.body || message;
  for (const [k, v] of Object.entries(vars ?? {})) {
    const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g');
    outTitle = outTitle.replace(re, v);
    outBody = outBody.replace(re, v);
  }
  return { title: outTitle, message: outBody };
}

async function dispatchStubs(
  channel: string,
  recipientIds: Types.ObjectId[],
  subject: string,
  body: string,
): Promise<void> {
  if (channel === 'IN_APP') return;
  const users = await UserModel.find({ _id: { $in: recipientIds } })
    .select('email phone')
    .lean();
  for (const u of users) {
    if (channel === 'EMAIL' && u.email) await sendEmailNotificationStub({ to: u.email, subject, body });
    if (channel === 'SMS' && u.phone) await sendSmsNotificationStub({ to: u.phone, body });
    if (channel === 'WHATSAPP' && u.phone) await sendWhatsappNotificationStub({ to: u.phone, body });
  }
}

class NotificationsService {
  async list(user: AuthenticatedUser, query: NotificationListQuery) {
    if (!userCan(user, PERMISSIONS.NOTIFICATION_READ)) throw ApiError.forbidden('Insufficient permissions');
    if (user.role === ROLES.STUDENT && query.recipientUserId && query.recipientUserId !== user.id) {
      throw ApiError.forbidden('Insufficient permissions');
    }
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const match: Record<string, unknown> = {};

    if (query.recipientUserId && query.recipientUserId !== user.id) {
      if (!userCan(user, PERMISSIONS.NOTIFICATION_MANAGE)) {
        throw ApiError.forbidden('Cannot list notifications for another user');
      }
      if (user.role !== ROLES.SUPER_ADMIN) {
        if (!user.libraryId) throw ApiError.forbidden('Library context required');
        const other = await UserModel.findById(query.recipientUserId).select('libraryId branchId').lean();
        if (!other?.libraryId || String(other.libraryId) !== user.libraryId) {
          throw ApiError.forbidden('User is not in your library');
        }
        if (user.role === ROLES.MANAGER && user.branchId && String(other.branchId) !== user.branchId) {
          throw ApiError.forbidden('User is not in your branch');
        }
      }
      match.recipientUserId = new Types.ObjectId(query.recipientUserId);
    } else {
      match.recipientUserId = new Types.ObjectId(user.id);
    }

    if (query.type) match.type = query.type;
    if (query.status) match.status = query.status;
    if (query.unreadOnly) match.readAt = null;

    if (user.role === ROLES.SUPER_ADMIN) {
      if (query.libraryId) match.libraryId = new Types.ObjectId(query.libraryId);
    } else if (user.libraryId) {
      match.libraryId = new Types.ObjectId(user.libraryId);
    }

    const [items, total] = await Promise.all([
      NotificationModel.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      NotificationModel.countDocuments(match),
    ]);
    const mapped = items.map((n) => ({
      ...n,
      _id: String(n._id),
      libraryId: n.libraryId ? String(n.libraryId) : null,
      branchId: n.branchId ? String(n.branchId) : null,
      recipientUserId: String(n.recipientUserId),
      createdBy: n.createdBy ? String(n.createdBy) : null,
    }));
    const enriched = await enrichRowsWithLookups(mapped as Record<string, unknown>[], {
      libraryIdKey: 'libraryId',
      branchIdKey: 'branchId',
      userIdKeys: ['recipientUserId', 'createdBy'],
    });
    return {
      items: enriched,
      meta: { pagination: buildPaginationMeta(total, page, limit) },
    };
  }

  async unreadCount(user: AuthenticatedUser) {
    if (!userCan(user, PERMISSIONS.NOTIFICATION_READ)) throw ApiError.forbidden('Insufficient permissions');
    const match: Record<string, unknown> = {
      recipientUserId: new Types.ObjectId(user.id),
      readAt: null,
    };
    if (user.role !== ROLES.SUPER_ADMIN && user.libraryId) {
      match.libraryId = new Types.ObjectId(user.libraryId);
    }
    const count = await NotificationModel.countDocuments(match);
    return { count };
  }

  async markRead(user: AuthenticatedUser, notificationId: string) {
    if (!userCan(user, PERMISSIONS.NOTIFICATION_READ)) throw ApiError.forbidden('Insufficient permissions');
    const res = await NotificationModel.findOneAndUpdate(
      { _id: new Types.ObjectId(notificationId), recipientUserId: new Types.ObjectId(user.id) },
      { $set: { readAt: new Date() } },
      { new: true },
    ).lean();
    if (!res) throw ApiError.notFound('Notification not found');
    return { ok: true };
  }

  async markAllRead(user: AuthenticatedUser) {
    if (!userCan(user, PERMISSIONS.NOTIFICATION_READ)) throw ApiError.forbidden('Insufficient permissions');
    const match: Record<string, unknown> = {
      recipientUserId: new Types.ObjectId(user.id),
      readAt: null,
    };
    if (user.role !== ROLES.SUPER_ADMIN && user.libraryId) {
      match.libraryId = new Types.ObjectId(user.libraryId);
    }
    const r = await NotificationModel.updateMany(match, { $set: { readAt: new Date() } });
    return { modified: r.modifiedCount };
  }

  private async writeLog(args: {
    libraryId: Types.ObjectId | null;
    branchId: Types.ObjectId | null;
    action: 'SEND' | 'BULK_SEND' | 'CRON';
    channel: string;
    type: string;
    summary: string;
    recipientCount: number;
    createdBy: Types.ObjectId | null;
    metadata: Record<string, unknown>;
  }) {
    await NotificationLogModel.create({
      libraryId: args.libraryId,
      branchId: args.branchId,
      notificationId: null,
      action: args.action,
      channel: args.channel,
      notificationType: args.type,
      summary: args.summary,
      recipientCount: args.recipientCount,
      createdBy: args.createdBy,
      metadata: args.metadata,
    });
  }

  async send(user: AuthenticatedUser, body: SendNotificationBody) {
    if (!userCan(user, PERMISSIONS.NOTIFICATION_SEND)) throw ApiError.forbidden('Insufficient permissions');
    assertNotificationTypeAllowed(user.role, body.type);
    assertSendTargetMode(user.role, body.target);
    const libraryOid = resolveLibraryOidForSend(user, body.libraryId, body.target);
    const { branchOid, senderBranchId } =
      body.target.mode === 'PLATFORM'
        ? { branchOid: null as Types.ObjectId | null, senderBranchId: null as string | null }
        : effectiveBranchFilter(user, body.branchId);
    const { title, message } = await applyTemplate(
      libraryOid,
      body.templateId,
      body.templateVariables,
      body.title,
      body.message,
    );
    let recipientIds = await resolveRecipientUserIds({
      libraryId: libraryOid,
      effectiveBranchId: branchOid,
      senderRole: user.role,
      senderBranchId,
      target: body.target,
    });
    const includeSelf = body.includeSelf === true;
    recipientIds = applyExcludeSelf(recipientIds, user.id, includeSelf, body.target.mode);
    if (recipientIds.length === 0) throw ApiError.badRequest('No recipients resolved');

    const rows = await buildRecipientRows(recipientIds);
    const now = new Date();
    const createdByOid = new Types.ObjectId(user.id);
    const channel = body.channel ?? 'IN_APP';
    const metaBase = {
      ...(body.metadata ?? {}),
      requestedChannel: channel,
      target: body.target,
      includeSelf,
      audit: { senderId: user.id, senderRole: user.role, at: now.toISOString() },
    };
    const docs = rows.map((row) => ({
      libraryId: row.libraryId ? new Types.ObjectId(row.libraryId) : libraryOid,
      branchId: branchOid ?? (row.branchId ? new Types.ObjectId(row.branchId) : null),
      recipientUserId: new Types.ObjectId(row.userId),
      recipientRole: null,
      recipientType: body.target.mode,
      title,
      message,
      type: body.type,
      channel: 'IN_APP',
      status: 'SENT',
      readAt: null,
      sentAt: now,
      metadata: metaBase,
      createdBy: createdByOid,
    }));
    await insertInAppNotifications(docs);
    await dispatchStubs(channel, recipientIds, title, message);

    const snapshot = {
      title,
      message,
      type: body.type,
      audience: body.target,
      includeSelf,
      recipients: rows.map((r) => ({
        userId: r.userId,
        fullName: r.fullName,
        email: r.email,
        role: r.role,
        branchName: r.branchName,
        libraryName: r.libraryName,
      })),
      statusBreakdown: defaultStatusBreakdown(recipientIds.length),
    };

    await this.writeLog({
      libraryId: libraryOid,
      branchId: branchOid,
      action: 'SEND',
      channel,
      type: body.type,
      summary: title.slice(0, 200),
      recipientCount: recipientIds.length,
      createdBy: createdByOid,
      metadata: { target: body.target, includeSelf, snapshot },
    });
    logActivity({
      actorUserId: user.id,
      action: 'NOTIFICATION_SEND',
      entityType: 'NOTIFICATION',
      entityId: null,
      libraryId: libraryOid ? String(libraryOid) : null,
      branchId: branchOid ? String(branchOid) : null,
      metadata: {
        title,
        description: title,
        entityLabel: title,
        recipientCount: recipientIds.length,
      },
    });
    return { sent: recipientIds.length };
  }

  async bulkSend(user: AuthenticatedUser, body: BulkSendBody) {
    if (!userCan(user, PERMISSIONS.NOTIFICATION_SEND)) throw ApiError.forbidden('Insufficient permissions');
    if (!body.items.length) throw ApiError.badRequest('No items');
    let total = 0;
    for (const item of body.items) {
      assertNotificationTypeAllowed(user.role, item.type);
      assertSendTargetMode(user.role, item.target);
      const libraryOid = resolveLibraryOidForSend(user, body.libraryId, item.target);
      const { branchOid, senderBranchId } =
        item.target.mode === 'PLATFORM'
          ? { branchOid: null as Types.ObjectId | null, senderBranchId: null as string | null }
          : effectiveBranchFilter(user, body.branchId);
      const { title, message } = await applyTemplate(
        libraryOid,
        item.templateId,
        item.templateVariables,
        item.title,
        item.message,
      );
      let recipientIds = await resolveRecipientUserIds({
        libraryId: libraryOid,
        effectiveBranchId: branchOid,
        senderRole: user.role,
        senderBranchId,
        target: item.target,
      });
      const includeSelf = item.includeSelf === true;
      recipientIds = applyExcludeSelf(recipientIds, user.id, includeSelf, item.target.mode);
      if (recipientIds.length === 0) continue;

      const rows = await buildRecipientRows(recipientIds);
      const now = new Date();
      const createdByOid = new Types.ObjectId(user.id);
      const channel = item.channel ?? 'IN_APP';
      const metaBase = {
        ...(item.metadata ?? {}),
        requestedChannel: channel,
        target: item.target,
        includeSelf,
        audit: { senderId: user.id, senderRole: user.role, at: now.toISOString(), bulk: true },
      };
      const docs = rows.map((row) => ({
        libraryId: row.libraryId ? new Types.ObjectId(row.libraryId) : libraryOid,
        branchId: branchOid ?? (row.branchId ? new Types.ObjectId(row.branchId) : null),
        recipientUserId: new Types.ObjectId(row.userId),
        recipientRole: null,
        recipientType: item.target.mode,
        title,
        message,
        type: item.type,
        channel: 'IN_APP',
        status: 'SENT',
        readAt: null,
        sentAt: now,
        metadata: metaBase,
        createdBy: createdByOid,
      }));
      await insertInAppNotifications(docs);
      await dispatchStubs(channel, recipientIds, title, message);
      total += recipientIds.length;

      const snapshot = {
        title,
        message,
        type: item.type,
        audience: item.target,
        includeSelf,
        recipients: rows.map((r) => ({
          userId: r.userId,
          fullName: r.fullName,
          email: r.email,
          role: r.role,
          branchName: r.branchName,
          libraryName: r.libraryName,
        })),
        statusBreakdown: defaultStatusBreakdown(recipientIds.length),
      };

      await this.writeLog({
        libraryId: libraryOid,
        branchId: branchOid,
        action: 'BULK_SEND',
        channel,
        type: item.type,
        summary: title.slice(0, 200),
        recipientCount: recipientIds.length,
        createdBy: createdByOid,
        metadata: { target: item.target, includeSelf, snapshot, bulkItem: true },
      });
    }
    return { sent: total };
  }

  async listTemplates(user: AuthenticatedUser, query: TemplateListQuery) {
    if (
      !userCan(user, PERMISSIONS.NOTIFICATION_READ) &&
      !userCan(user, PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE) &&
      !userCan(user, PERMISSIONS.NOTIFICATION_SEND)
    ) {
      throw ApiError.forbidden('Insufficient permissions');
    }
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const match: Record<string, unknown> = {};
    if (user.role === ROLES.SUPER_ADMIN) {
      if (query.libraryId) match.libraryId = new Types.ObjectId(query.libraryId);
    } else {
      if (!user.libraryId) throw ApiError.forbidden('Library required');
      match.libraryId = new Types.ObjectId(user.libraryId);
      if (user.branchId) match.$or = [{ branchId: new Types.ObjectId(user.branchId) }, { branchId: null }];
    }
    if (query.active !== undefined) match.active = query.active;
    const [items, total] = await Promise.all([
      NotificationTemplateModel.find(match).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      NotificationTemplateModel.countDocuments(match),
    ]);
    return {
      items: items.map((t) => ({
        ...t,
        _id: String(t._id),
        libraryId: t.libraryId ? String(t.libraryId) : null,
        branchId: t.branchId ? String(t.branchId) : null,
      })),
      meta: { pagination: buildPaginationMeta(total, page, limit) },
    };
  }

  async createTemplate(user: AuthenticatedUser, body: CreateTemplateBody) {
    if (!userCan(user, PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE)) throw ApiError.forbidden('Insufficient permissions');
    const libraryId =
      user.role === ROLES.SUPER_ADMIN
        ? body.libraryId
          ? new Types.ObjectId(body.libraryId)
          : null
        : new Types.ObjectId(user.libraryId!);
    if (user.role !== ROLES.SUPER_ADMIN && !user.libraryId) throw ApiError.forbidden('Library required');
    const tpl = await NotificationTemplateModel.create({
      libraryId,
      branchId: body.branchId ? new Types.ObjectId(body.branchId) : null,
      name: body.name,
      type: body.type,
      subject: body.subject,
      body: body.body,
      variables: body.variables ?? [],
      active: body.active,
    });
    return { template: { ...tpl.toObject(), _id: String(tpl._id) } };
  }

  async updateTemplate(user: AuthenticatedUser, templateId: string, body: UpdateTemplateBody) {
    if (!userCan(user, PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE)) throw ApiError.forbidden('Insufficient permissions');
    const tpl = await NotificationTemplateModel.findById(templateId);
    if (!tpl) throw ApiError.notFound('Template not found');
    if (user.role !== ROLES.SUPER_ADMIN) {
      if (!user.libraryId || String(tpl.libraryId) !== user.libraryId) throw ApiError.forbidden('Invalid template');
    }
    if (body.name !== undefined) tpl.name = body.name;
    if (body.subject !== undefined) tpl.subject = body.subject;
    if (body.body !== undefined) tpl.body = body.body;
    if (body.variables !== undefined) tpl.variables = body.variables;
    if (body.active !== undefined) tpl.active = body.active;
    if (body.type !== undefined) tpl.type = body.type;
    await tpl.save();
    return { template: { ...tpl.toObject(), _id: String(tpl._id) } };
  }

  async deleteTemplate(user: AuthenticatedUser, templateId: string) {
    if (!userCan(user, PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE)) throw ApiError.forbidden('Insufficient permissions');
    const tpl = await NotificationTemplateModel.findById(templateId);
    if (!tpl) throw ApiError.notFound('Template not found');
    if (user.role !== ROLES.SUPER_ADMIN) {
      if (!user.libraryId || String(tpl.libraryId) !== user.libraryId) throw ApiError.forbidden('Invalid template');
    }
    await tpl.deleteOne();
    return { ok: true };
  }

  async listLogs(user: AuthenticatedUser, query: LogsListQuery) {
    if (!userCan(user, PERMISSIONS.NOTIFICATION_MANAGE)) throw ApiError.forbidden('Insufficient permissions');
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const match: Record<string, unknown> = {};
    if (user.role === ROLES.SUPER_ADMIN) {
      if (query.libraryId) match.libraryId = new Types.ObjectId(query.libraryId);
    } else {
      if (!user.libraryId) throw ApiError.forbidden('Library required');
      match.libraryId = new Types.ObjectId(user.libraryId);
      if (user.role === ROLES.MANAGER) {
        if (!user.branchId) throw ApiError.forbidden('Branch required');
        match.branchId = new Types.ObjectId(user.branchId);
      } else if (query.branchId) {
        match.branchId = new Types.ObjectId(query.branchId);
      }
    }
    const [items, total] = await Promise.all([
      NotificationLogModel.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      NotificationLogModel.countDocuments(match),
    ]);
    const mapped = items.map((l) => ({
      ...l,
      _id: String(l._id),
      libraryId: l.libraryId ? String(l.libraryId) : null,
      branchId: l.branchId ? String(l.branchId) : null,
      createdBy: l.createdBy ? String(l.createdBy) : null,
    }));
    const enriched = await enrichRowsWithLookups(mapped as Record<string, unknown>[], {
      libraryIdKey: 'libraryId',
      branchIdKey: 'branchId',
      userIdKeys: ['createdBy'],
    });
    return {
      items: enriched,
      meta: { pagination: buildPaginationMeta(total, page, limit) },
    };
  }

  async listRecipients(user: AuthenticatedUser, query: RecipientsListQuery) {
    if (!userCan(user, PERMISSIONS.NOTIFICATION_SEND)) throw ApiError.forbidden('Insufficient permissions');
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const match: Record<string, unknown> = { isActive: true };

    if (user.role === ROLES.SUPER_ADMIN) {
      if (!query.libraryId) throw ApiError.badRequest('libraryId is required');
      match.libraryId = new Types.ObjectId(query.libraryId);
    } else {
      if (!user.libraryId) throw ApiError.forbidden('Library required');
      match.libraryId = new Types.ObjectId(user.libraryId);
      if (user.role === ROLES.MANAGER) {
        if (!user.branchId) throw ApiError.forbidden('Branch required');
        match.branchId = new Types.ObjectId(user.branchId);
      } else if (query.branchId) {
        match.branchId = new Types.ObjectId(query.branchId);
      }
    }

    if (query.role) {
      const rid = await RoleModel.findOne({ name: query.role.toUpperCase() }).select('_id').lean();
      if (!rid) {
        return {
          items: [] as { userId: string; fullName: string; email: string; phone: string | null; role: string; branchName: string | null; libraryName: string | null }[],
          meta: { pagination: buildPaginationMeta(0, page, limit) },
        };
      }
      match.role = rid._id;
    }

    const qTrim = query.q?.trim();
    let postProjectQMatch: Record<string, unknown> | null = null;
    if (qTrim) {
      const esc = qTrim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(esc, 'i');
      postProjectQMatch = {
        $or: [{ fullName: rx }, { email: rx }, { phone: rx }, { role: rx }],
      };
    }

    const lookupAndProject: PipelineStage[] = [
      { $match: match },
      {
        $lookup: {
          from: RoleModel.collection.name,
          localField: 'role',
          foreignField: '_id',
          as: 'rd',
        },
      },
      {
        $lookup: {
          from: BranchModel.collection.name,
          localField: 'branchId',
          foreignField: '_id',
          as: 'bd',
        },
      },
      {
        $lookup: {
          from: LibraryModel.collection.name,
          localField: 'libraryId',
          foreignField: '_id',
          as: 'ld',
        },
      },
      {
        $project: {
          userId: '$_id',
          fullName: 1,
          email: 1,
          phone: 1,
          role: { $ifNull: [{ $arrayElemAt: ['$rd.name', 0] }, ''] },
          branchName: { $arrayElemAt: ['$bd.branchName', 0] },
          libraryName: { $arrayElemAt: ['$ld.name', 0] },
        },
      },
    ];
    if (postProjectQMatch) {
      lookupAndProject.push({ $match: postProjectQMatch });
    }

    const [items, countAgg] = await Promise.all([
      UserModel.aggregate<{
        userId: Types.ObjectId;
        fullName: string;
        email: string;
        phone?: string | null;
        role: string;
        branchName: string | null;
        libraryName: string | null;
      }>([...lookupAndProject, { $sort: { fullName: 1 } }, { $skip: skip }, { $limit: limit }]),
      UserModel.aggregate<{ total: number }>([...lookupAndProject, { $count: 'total' }]),
    ]);
    const total = countAgg[0]?.total ?? 0;

    return {
      items: items.map((r) => ({
        userId: String(r.userId),
        fullName: r.fullName,
        email: r.email,
        phone: r.phone ?? null,
        role: String(r.role ?? ''),
        branchName: r.branchName ? String(r.branchName) : null,
        libraryName: r.libraryName ? String(r.libraryName) : null,
      })),
      meta: { pagination: buildPaginationMeta(total, page, limit) },
    };
  }

  async getLogById(user: AuthenticatedUser, logId: string) {
    if (!userCan(user, PERMISSIONS.NOTIFICATION_MANAGE)) throw ApiError.forbidden('Insufficient permissions');
    const log = await NotificationLogModel.findById(logId).lean();
    if (!log) throw ApiError.notFound('Log not found');

    if (user.role !== ROLES.SUPER_ADMIN) {
      if (!user.libraryId || !log.libraryId || String(log.libraryId) !== user.libraryId) {
        throw ApiError.forbidden('Invalid log');
      }
      if (user.role === ROLES.MANAGER) {
        if (!user.branchId || !log.branchId || String(log.branchId) !== user.branchId) {
          throw ApiError.forbidden('Invalid log');
        }
      }
    }

    let createdBy: { id: string; fullName: string; email: string } | null = null;
    if (log.createdBy) {
      const u = await UserModel.findById(log.createdBy).select('fullName email').lean();
      if (u) createdBy = { id: String(log.createdBy), fullName: u.fullName, email: u.email };
    }

    const meta = (log.metadata ?? {}) as Record<string, unknown>;
    const snap = meta.snapshot as
      | {
          title?: string;
          message?: string;
          type?: string;
          audience?: unknown;
          includeSelf?: boolean;
          recipients?: Array<{
            userId: string;
            fullName: string;
            email: string;
            role: string;
            branchName: string | null;
            libraryName: string | null;
          }>;
          statusBreakdown?: { SENT: number; FAILED: number; PENDING: number };
        }
      | undefined;

    if (snap && typeof snap.title === 'string' && typeof snap.message === 'string') {
      return {
        id: String(log._id),
        action: log.action,
        channel: log.channel,
        createdAt: log.createdAt,
        createdBy,
        title: snap.title,
        message: snap.message,
        type: snap.type ?? log.notificationType,
        audience: snap.audience ?? meta.target ?? null,
        includeSelf: Boolean(snap.includeSelf ?? meta.includeSelf),
        recipients: snap.recipients ?? [],
        recipientNames: (snap.recipients ?? []).map((r) => r.fullName),
        recipientCount: log.recipientCount,
        statusBreakdown: snap.statusBreakdown ?? defaultStatusBreakdown(log.recipientCount),
      };
    }

    return {
      id: String(log._id),
      action: log.action,
      channel: log.channel,
      createdAt: log.createdAt,
      createdBy,
      title: log.summary,
      message: null as string | null,
      type: log.notificationType,
      audience: meta.target ?? null,
      includeSelf: Boolean(meta.includeSelf),
      recipients: [] as Array<Record<string, unknown>>,
      recipientNames: [] as string[],
      recipientCount: log.recipientCount,
      statusBreakdown: defaultStatusBreakdown(log.recipientCount),
      legacy: true as const,
    };
  }

  /** Used by cron jobs (no HTTP user). */
  async dispatchCronReminder(args: {
    libraryId: Types.ObjectId;
    branchId: Types.ObjectId | null;
    type: NotificationTypeEnum;
    title: string;
    message: string;
    recipientUserIds: Types.ObjectId[];
  }) {
    if (args.recipientUserIds.length === 0) return { sent: 0 };
    const now = new Date();
    const docs = args.recipientUserIds.map((rid) => ({
      libraryId: args.libraryId,
      branchId: args.branchId,
      recipientUserId: rid,
      recipientRole: null,
      recipientType: 'USER',
      title: args.title,
      message: args.message,
      type: args.type,
      channel: 'IN_APP',
      status: 'SENT',
      readAt: null,
      sentAt: now,
      metadata: { source: 'CRON' },
      createdBy: null,
    }));
    await insertInAppNotifications(docs);
    const rows = await buildRecipientRows(args.recipientUserIds);
    const snapshot = {
      title: args.title,
      message: args.message,
      type: args.type,
      audience: { mode: 'USER' as const },
      includeSelf: false,
      recipients: rows.map((r) => ({
        userId: r.userId,
        fullName: r.fullName,
        email: r.email,
        role: r.role,
        branchName: r.branchName,
        libraryName: r.libraryName,
      })),
      statusBreakdown: defaultStatusBreakdown(args.recipientUserIds.length),
    };
    await this.writeLog({
      libraryId: args.libraryId,
      branchId: args.branchId,
      action: 'CRON',
      channel: 'IN_APP',
      type: args.type,
      summary: args.title.slice(0, 200),
      recipientCount: args.recipientUserIds.length,
      createdBy: null,
      metadata: { cron: true, snapshot },
    });
    return { sent: args.recipientUserIds.length };
  }
}

export const notificationsService = new NotificationsService();
