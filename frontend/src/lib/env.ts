/**
 * Typed access to public environment variables.
 * Use these helpers everywhere instead of `process.env` directly.
 */
export const ENV = {
  APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? 'Library ERP',
  APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  API_BASE_URL:
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5000/api/v1',
} as const;
