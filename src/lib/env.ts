/**
 * Environment variable validation.
 * Import this module early to fail fast on misconfiguration.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in .env.local or your deployment configuration.`
    );
  }
  return value;
}

// Validate on import — this runs at startup
if (typeof window === "undefined") {
  // Server-side only validation
  requireEnv("DATABASE_URL");
  const secret = requireEnv("NEXTAUTH_SECRET");
  requireEnv("GEMINI_API_KEY");

  // The secret signs every JWT session; a weak/guessable one lets anyone forge
  // a session for any user. In production, demand real entropy and reject
  // obviously hand-chosen values. (openssl rand -base64 32 → 44 chars.)
  if (process.env.NODE_ENV === "production") {
    if (secret.length < 32) {
      throw new Error("NEXTAUTH_SECRET is too short — use `openssl rand -base64 32`.");
    }
    if (/sheetgpt|primy|drafta|secret|password|changeme|prod-secret/i.test(secret)) {
      throw new Error("NEXTAUTH_SECRET looks hand-chosen — generate a random one with `openssl rand -base64 32`.");
    }
  }
}

export {};
