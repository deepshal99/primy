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

/**
 * Closed-access gate for NEW account creation. SIGNUP_ALLOWLIST is a
 * comma-separated list of emails permitted to create an account on first
 * passwordless login. If it's empty/unset, signup is open to anyone.
 * Existing users always authenticate regardless of this list — it only
 * controls account *creation*. Dev-only (*.local) emails are always allowed
 * so the local admin flow is never blocked.
 */
export function isSignupAllowed(email: string): boolean {
  const raw = process.env.SIGNUP_ALLOWLIST?.trim();
  if (!raw) return true; // open signup when no allowlist configured
  if (isDevOnlyEmail(email)) return true;
  const allowed = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

/**
 * Reject passwords known to be compromised, via HaveIBeenPwned's k-anonymity
 * range API — only the first 5 chars of the SHA-1 ever leave the server, never
 * the password. FAILS OPEN: if HIBP is unreachable, we allow the password
 * rather than block signups on a third-party outage.
 */
export async function isBreachedPassword(password: string): Promise<boolean> {
  try {
    const { createHash } = await import("crypto");
    const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const body = await res.text();
    for (const line of body.split("\n")) {
      const [hashSuffix, count] = line.split(":");
      if (hashSuffix?.trim() === suffix && Number(count) > 0) return true;
    }
    return false;
  } catch {
    return false; // fail open
  }
}
