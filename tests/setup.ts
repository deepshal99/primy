/**
 * Global test setup.
 *
 * Loads .env.local for DATABASE_URL_TEST if present. Tests that need a
 * real database should use the helper in tests/helpers/db.ts which
 * skips the test gracefully when DATABASE_URL_TEST is missing.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });
