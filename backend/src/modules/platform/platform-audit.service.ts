import { Types } from 'mongoose';

import { AuditLogModel } from './audit-log.model';

export async function appendPlatformAuditLog(input: {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  libraryId?: string | null;
  branchId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await AuditLogModel.create({
    actorUserId: input.actorUserId ? new Types.ObjectId(input.actorUserId) : null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ? new Types.ObjectId(input.entityId) : null,
    libraryId: input.libraryId ? new Types.ObjectId(input.libraryId) : null,
    branchId: input.branchId ? new Types.ObjectId(input.branchId) : null,
    metadata: input.metadata ?? {},
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });
}
