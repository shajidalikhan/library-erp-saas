import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Strongly-typed, validated environment loader.
 * Fail-fast at startup if anything required is missing or malformed.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  API_PREFIX: z.string().default('/api/v1'),

  MONGODB_URI: z.string().url({ message: 'MONGODB_URI must be a valid URI' }),
  MONGODB_DB_NAME: z.string().default('library_erp'),

  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  JWT_ISSUER: z.string().default('library-erp'),
  JWT_AUDIENCE: z.string().default('library-erp-client'),

  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  /** When true, allows any browser Origin (debug only — set false in production). */
  CORS_RELAXED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),

  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'http', 'debug'])
    .default('info'),

  /** When true, registers node-cron reminder jobs (payment due, overdue, membership expiry). */
  NOTIFICATION_JOBS_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  /** When true, auto-checks out students after shift/library closing + grace. */
  AUTO_CHECKOUT_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),

  /** Grace period (minutes) after shift/library end before system auto-checkout. */
  AUTO_CHECKOUT_GRACE_MINUTES: z.coerce.number().int().min(0).max(240).default(30),

  /** Grace period (minutes) after shift start before a check-in is marked LATE. */
  ATTENDANCE_LATE_GRACE_MINUTES: z.coerce.number().int().min(0).max(120).default(15),

  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().positive().optional().default(587),
  SMTP_SECURE: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().optional().default(''),

  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
  CLOUDINARY_UPLOAD_FOLDER: z.string().optional().default('library-erp'),

  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  PUBLIC_BOOKING_HOLD_HOURS: z.coerce.number().int().min(1).max(24).default(3),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    '\u274C  Invalid environment variables:\n',
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

const env = parsed.data;

export const ENV = {
  ...env,
  IS_PROD: env.NODE_ENV === 'production',
  IS_DEV: env.NODE_ENV === 'development',
  IS_TEST: env.NODE_ENV === 'test',
  CORS_ORIGINS_LIST: env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  SMTP_CONFIGURED: Boolean(env.SMTP_HOST?.trim() && env.SMTP_USER?.trim() && env.SMTP_PASS?.trim()),
  SMTP_SECURE_EFFECTIVE:
    env.SMTP_SECURE || env.SMTP_PORT === 465,
};

export type AppEnv = typeof ENV;
