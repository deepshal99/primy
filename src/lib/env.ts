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

// Validate on import — this runs at startup.
//
// Skip ALL of this during `next build` — page-data collection imports server
// routes (e.g. /api/chat), evaluating this module with whatever env the build
// host happens to have. Preview deploys don't carry DATABASE_URL/secrets, so
// requiring them here crashed the build ("Failed to collect page data"). These
// are RUNTIME guards: they re-run when the server actually boots to serve.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
if (typeof window === "undefined" && !isBuildPhase) {
  // Server-side only validation
  requireEnv("DATABASE_URL");
  const secret = requireEnv("NEXTAUTH_SECRET");
  // OpenAI is the only provider routed today (chat, deck, title, summarize,
  // embeddings) — see src/lib/ai/modelRouter.ts. GEMINI_API_KEY feeds a dormant
  // Google client and is optional.
  requireEnv("OPENAI_API_KEY");

  // The secret signs every JWT session; a weak/guessable one lets anyone forge
  // a session for any user. In production demand real entropy and reject
  // obviously hand-chosen values. (openssl rand -base64 32 → 44 chars.)
  if (process.env.NODE_ENV === "production") {
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
