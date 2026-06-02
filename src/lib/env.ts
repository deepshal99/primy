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
  // a session for any user. In production demand real entropy and reject
  // obviously hand-chosen values. (openssl rand -base64 32 → 44 chars.)
  //
  // Skip during `next build` — that runs with NODE_ENV=production but is a local
  // build step, not the deployed server, and may read a dev .env.local. These
  // are RUNTIME guards (they re-run when the server actually boots to serve).
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
  if (process.env.NODE_ENV === "production" && !isBuildPhase) {
    if (secret.length < 32) {
      throw new Error("NEXTAUTH_SECRET is too short — use `openssl rand -base64 32`.");
    }
    if (/sheetgpt|primy|drafta|secret|password|changeme|prod-secret/i.test(secret)) {
      throw new Error("NEXTAUTH_SECRET looks hand-chosen — generate a random one with `openssl rand -base64 32`.");
    }
    // The dev auto-login bypass must NEVER be enabled in production.
    if (process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true") {
      throw new Error("NEXT_PUBLIC_DEV_AUTH_BYPASS=true is set in production — refusing to boot.");
    }
  }
}

export {};
