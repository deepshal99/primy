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
  requireEnv("NEXTAUTH_SECRET");
  requireEnv("GEMINI_API_KEY");
}

export {};
