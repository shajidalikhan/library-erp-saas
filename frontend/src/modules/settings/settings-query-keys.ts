export const settingsQueryKeys = {
  all: ['settings'] as const,
  profile: () => [...settingsQueryKeys.all, 'profile'] as const,
  notifications: () => [...settingsQueryKeys.all, 'notifications'] as const,
  email: () => [...settingsQueryKeys.all, 'email'] as const,
  emailTemplates: () => [...settingsQueryKeys.all, 'email-templates'] as const,
  emailTemplate: (key: string) => [...settingsQueryKeys.emailTemplates(), key] as const,
};
