import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest config for Primy.
 *
 * Integration tests use a dedicated Neon test branch via DATABASE_URL_TEST.
 * Set this in .env.local or CI; tests skip when it's missing.
 *
 * Run:
 *   npm test              -- watch mode
 *   npm run test:run      -- single run
 *   npm run test:ui       -- web UI
 *   npm run test:coverage -- with coverage report
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/billing/**", "src/lib/plans.ts", "src/lib/ai/modelRouter.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
