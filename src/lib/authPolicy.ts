/**
 * Shared auth/password policy — used by sign-up, password reset, and the
 * change-password route so the rules can never drift between entry points.
 */

// bcrypt only hashes the first 72 BYTES; anything longer is silently ignored,
// so a 200-char password and its 72-byte prefix would both authenticate.
// Reject over-long input rather than give a false sense of strength.
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX_BYTES = 72;

/** Returns an error string if the password is unacceptable, else null. */
export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters.`;
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return "Password is too long (max 72 bytes).";
  }
  return null;
}

/**
 * Dev-only accounts (admin@*.local) must never be authenticatable in
 * production, even if such a row somehow exists in the prod database.
 */
export function isDevOnlyEmail(email: string): boolean {
  return /@[a-z0-9.-]*\.local$/i.test(email);
}
