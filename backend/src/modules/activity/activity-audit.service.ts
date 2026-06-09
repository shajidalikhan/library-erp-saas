import { appendPlatformAuditLog } from '@modules/platform/platform-audit.service';

export const appendAuditLog = appendPlatformAuditLog;

export function logActivity(input: Parameters<typeof appendPlatformAuditLog>[0]): void {
  void appendPlatformAuditLog(input).catch(() => undefined);
}
