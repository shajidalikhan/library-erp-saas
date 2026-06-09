/**
 * Auth-module-local constants.
 */
export const AUTH_CONSTANTS = {
  /** Maximum simultaneous refresh tokens stored per user before oldest is rotated out. */
  MAX_REFRESH_TOKENS_PER_USER: 5,

  /** Generic message returned for any invalid-credentials scenario (login). */
  INVALID_CREDENTIALS_MSG: 'Invalid email or password',

  /** Generic forgot-password response (anti-enumeration). */
  FORGOT_PASSWORD_SUCCESS_MSG: 'If an account exists, reset instructions have been sent.',

  /** Reset token lifetime in milliseconds. */
  RESET_PASSWORD_TTL_MS: 30 * 60 * 1000,

  RESET_PASSWORD_SUCCESS_MSG: 'Password reset successful. Please sign in with your new password.',
  RESET_PASSWORD_INVALID_MSG: 'Invalid or expired reset token',
} as const;
