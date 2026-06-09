export type EntityLabelType =
  | 'library'
  | 'branch'
  | 'student'
  | 'user'
  | 'seat'
  | 'invoice'
  | 'payment'
  | 'notification'
  | 'audit';

type EntityLike = object | null | undefined;

const text = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const next = String(value).trim();
  return next.length ? next : null;
};

const joinParts = (parts: Array<string | null | undefined>, separator = ' · '): string =>
  parts.filter((part): part is string => Boolean(part && part.trim())).join(separator);

const asRecord = (entity: EntityLike): Record<string, unknown> =>
  (entity ?? {}) as Record<string, unknown>;

export function formatEntityLabel(entity: EntityLike, type: EntityLabelType): string {
  if (!entity) {
    switch (type) {
      case 'library':
        return 'Unknown library';
      case 'branch':
        return 'Unknown branch';
      case 'student':
        return 'Unknown student';
      case 'user':
        return 'Unknown user';
      case 'seat':
        return 'Unknown seat';
      case 'invoice':
        return 'Unknown invoice';
      case 'payment':
        return 'Unknown payment';
      case 'notification':
        return 'Unknown recipient';
      case 'audit':
        return 'Unknown actor';
      default:
        return 'Unknown';
    }
  }

  const record = asRecord(entity);

  switch (type) {
    case 'library':
      return joinParts([text(record.libraryName) ?? text(record.name), text(record.librarySlug) ?? text(record.slug)]);
    case 'branch':
      return joinParts([text(record.branchName), text(record.branchCode)]);
    case 'student':
      return joinParts([text(record.studentName) ?? text(record.fullName), text(record.studentCode) ?? text(record.studentId)]);
    case 'user':
      return joinParts([text(record.userName) ?? text(record.fullName), text(record.userEmail) ?? text(record.email)]);
    case 'seat':
      return joinParts([
        text(record.seatNumber),
        joinParts([text(record.seatFloor) ?? text(record.floor), text(record.seatZone) ?? text(record.zone)], ' / '),
      ]);
    case 'invoice':
      return joinParts([
        text(record.invoiceNumber),
        text(record.studentName),
        record.dueAmount !== undefined ? `Due ${Number(record.dueAmount).toFixed(2)}` : null,
      ]);
    case 'payment':
      return joinParts([
        text(record.receiptNumber) ?? text(record.invoiceNumber),
        text(record.studentName),
        record.amount !== undefined ? `₹${Number(record.amount).toFixed(2)}` : null,
      ]);
    case 'notification':
      return joinParts([
        text(record.recipientName) ?? text(record.fullName),
        text(record.recipientRole) ?? text(record.role),
      ]);
    case 'audit':
      return joinParts([text(record.actorName), text(record.actorEmail)]);
    default:
      return 'Unknown';
  }
}
