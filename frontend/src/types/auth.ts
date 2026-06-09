import type { PermissionName, RoleName } from '@/constants/permissions';

export type RoleCapabilityModule =
  | 'students'
  | 'attendance'
  | 'seats'
  | 'shifts'
  | 'payments'
  | 'invoices'
  | 'dues'
  | 'reports'
  | 'analytics'
  | 'notifications'
  | 'settings'
  | 'public_booking';

export type RoleCapabilities = Partial<
  Record<RoleCapabilityModule, Record<string, boolean>>
>;

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: RoleName;
  permissions: PermissionName[];
  libraryId: string | null;
  branchId: string | null;
  libraryName?: string | null;
  libraryLogo?: string | null;
  branchName?: string | null;
  studentId?: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Derived module flags for sidebar (any action enabled). */
  roleModules?: Record<RoleCapabilityModule, boolean>;
  /** Full action-level capability matrix for the user's role. */
  roleCapabilities?: RoleCapabilities;
  /** Effective SaaS plan feature flags for the user's library. */
  subscriptionFeatures?: Record<string, boolean>;
  /** Plan features + enabled/disabled tenant overrides (same as subscriptionFeatures). */
  effectiveFeatures?: Record<string, boolean>;
  enabledFeaturesOverride?: string[];
  disabledFeaturesOverride?: string[];
  subscriptionPlanName?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSession {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
