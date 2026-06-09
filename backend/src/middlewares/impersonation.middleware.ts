import type { RequestHandler } from 'express';

/**
 * Impersonation placeholder (future).
 *
 * Intended flow (not implemented):
 * - Super admin requests a short-lived signed token bound to subject user + actor.
 * - Client sends `X-Impersonation-Context: <jwt>`; middleware verifies signature,
 *   loads subject session, and attaches `req.impersonation` for downstream audit.
 * - Every mutation must log actor + subject in {@link appendPlatformAuditLog}.
 */
export const impersonationContextPlaceholder: RequestHandler = (_req, _res, next) => {
  next();
};
