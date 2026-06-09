import type { PaginationMeta } from '@/types/api';
import type { MediaAsset } from '@/lib/media-url';

export type LibraryStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED';

export type SubscriptionPlan =
  | 'FREE'
  | 'STARTER'
  | 'BASIC'
  | 'GROWTH'
  | 'PROFESSIONAL'
  | 'ENTERPRISE';

export type SubscriptionExpiryState =
  | 'ACTIVE'
  | 'TRIAL'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'GRACE_PERIOD'
  | 'OVERDUE'
  | 'SUSPENDED'
  | 'CANCELLED';

export interface SubscriptionPlanRef {
  id: string | null;
  code: string;
  displayName: string;
}

export interface LibrarySubscriptionSummary {
  planCode: string;
  planName: string;
  billingCycle: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  trialEndsAt: string | null;
  daysRemaining: number | null;
  graceDaysRemaining: number | null;
  expiryState: SubscriptionExpiryState;
  badgeLabel: string;
  dueAmount: number;
  lastPaymentAt: string | null;
  warningMessage: string | null;
  currentInvoice?: {
    id: string;
    invoiceNumber: string;
    amount: number;
    paidAmount: number;
    dueAmount: number;
    dueDate: string;
    status: string;
  } | null;
}

export interface Library {
  _id: string;
  name: string;
  slug: string;
  ownerId: string | null;
  email: string;
  phone?: string;
  gstNumber?: string;
  logo?: string | MediaAsset | null;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  timezone: string;
  subscriptionPlan: SubscriptionPlan;
  status: LibraryStatus;
  plan?: SubscriptionPlanRef;
  subscription?: LibrarySubscriptionSummary;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  _id: string;
  libraryId: string;
  branchName: string;
  branchCode: string;
  managerId: string | null;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  totalSeats: number;
  active: boolean;
  logo?: MediaAsset | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  pagination: PaginationMeta;
}
