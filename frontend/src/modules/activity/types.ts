export type ActivityEventType =
  | 'student_created'
  | 'student_updated'
  | 'seat_assigned'
  | 'seat_unassigned'
  | 'check_in'
  | 'check_out'
  | 'invoice_created'
  | 'payment_collected'
  | 'notification_sent'
  | 'branch_created'
  | 'user_created'
  | 'tenant_updated'
  | 'tenant_suspended'
  | 'tenant_activated'
  | 'login'
  | 'other';

export interface RecentActivityItem {
  id: string;
  type: ActivityEventType;
  title: string;
  description: string;
  actorName: string | null;
  entityLabel: string | null;
  libraryName: string | null;
  branchName: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}
