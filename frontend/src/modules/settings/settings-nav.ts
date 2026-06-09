import { ROLES } from '@/constants/permissions';

export type SettingsSectionId =
  | 'profile'
  | 'security'
  | 'organization'
  | 'email'
  | 'email-templates'
  | 'notifications'
  | 'platform'
  | 'appearance';

export type SettingsNavItem = {
  id: SettingsSectionId;
  label: string;
  href: string;
  roles: string[];
};

const base = '/dashboard/settings';

export const SETTINGS_NAV: SettingsNavItem[] = [
  {
    id: 'profile',
    label: 'Profile',
    href: `${base}/profile`,
    roles: [
      ROLES.SUPER_ADMIN,
      ROLES.LIBRARY_OWNER,
      ROLES.MANAGER,
      ROLES.RECEPTIONIST,
      ROLES.ACCOUNTANT,
      ROLES.SECURITY,
      ROLES.STUDENT,
    ],
  },
  {
    id: 'security',
    label: 'Security',
    href: `${base}/security`,
    roles: [
      ROLES.SUPER_ADMIN,
      ROLES.LIBRARY_OWNER,
      ROLES.MANAGER,
      ROLES.RECEPTIONIST,
      ROLES.ACCOUNTANT,
      ROLES.SECURITY,
      ROLES.STUDENT,
    ],
  },
  {
    id: 'organization',
    label: 'Organization',
    href: `${base}/organization`,
    roles: [ROLES.LIBRARY_OWNER],
  },
  {
    id: 'email',
    label: 'Email',
    href: `${base}/email`,
    roles: [ROLES.SUPER_ADMIN],
  },
  {
    id: 'email-templates',
    label: 'Email templates',
    href: `${base}/email-templates`,
    roles: [ROLES.SUPER_ADMIN],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    href: `${base}/notifications`,
    roles: [ROLES.SUPER_ADMIN, ROLES.LIBRARY_OWNER],
  },
  {
    id: 'platform',
    label: 'Platform',
    href: `${base}/platform`,
    roles: [ROLES.SUPER_ADMIN],
  },
  {
    id: 'appearance',
    label: 'Appearance',
    href: `${base}/appearance`,
    roles: [
      ROLES.SUPER_ADMIN,
      ROLES.LIBRARY_OWNER,
      ROLES.MANAGER,
      ROLES.RECEPTIONIST,
      ROLES.ACCOUNTANT,
      ROLES.SECURITY,
      ROLES.STUDENT,
    ],
  },
];

export function getSettingsNavForRole(role: string | undefined): SettingsNavItem[] {
  if (!role) return [];
  return SETTINGS_NAV.filter((item) => item.roles.includes(role));
}
