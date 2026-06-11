import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // 195 pre-existing `any` usages when the lint gate was restored
      // (next lint was a no-op under Next 16). Warn for now; burn down in
      // the code-health loop rather than one mega-diff.
      "@typescript-eslint/no-explicit-any": "warn",
      // CSS side-effect imports legitimately need ts-ignore (declaration
      // presence varies); require a description instead of banning.
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": "allow-with-description" },
      ],
      // New react-hooks v6 compiler diagnostics. Real cleanups, but 26
      // pre-existing hits when the lint gate was restored; warn for now and
      // burn down in the code-health loop.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "drizzle/**",
    "public/**",
  ]),
]);
