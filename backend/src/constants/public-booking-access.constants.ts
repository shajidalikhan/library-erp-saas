import type { RoleCapabilityModule } from '@constants/role-capabilities.constants';

export const PUBLIC_BOOKING_SUBSCRIPTION_FEATURE = 'public_booking';

export const PUBLIC_BOOKING_CAPABILITY_MODULE: RoleCapabilityModule = 'public_booking';

export const PUBLIC_BOOKING_ACCESS_MESSAGES = {
  rbac: 'You do not have permission to manage public bookings.',
  subscription: 'Your current subscription plan does not include Public Booking.',
  roleCapability: 'Public Booking is disabled for your role.',
  page: 'You do not have access to Public Booking.',
} as const;
