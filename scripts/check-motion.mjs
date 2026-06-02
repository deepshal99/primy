#!/usr/bin/env node
/**
 * check-motion.mjs — enforce the Primy motion ruleset (documents/motion.md).
 *
 * Scans src/** for the common animation violations from the
 * emil-design-eng framework. Zero dependencies (Node fs only).
 *
 *   node scripts/check-motion.mjs          # report; exit 1 if HARD violations
 *   node scripts/check-motion.mjs --strict # exit 1 on ANY violation (incl. warnings)
 *
 * Wired as `npm run lint:motion`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const STRICT = process.argv.includes("--strict");

/** Files allowed to break a rule on purpose; keep this list tiny + justified. */
const ALLOWLIST = [
  // motion.css owns the canonical primitives + their reduced-motion blocks.
  "src/styles/motion.css",
  // design.ts is the JS mirror of the canonical CSS tokens (curves defined here on purpose).
  "src/lib/design.ts",
  // Decorative looping loader — constant motion, not interactive UI.
  "src/components/dotmatrix-loader.css",
];

/**
 * Rule = { id, severity: "error"|"warn", test(line), why }.
 * `test` runs per non-comment line; return true to flag.
 */
const RULES = [
  {
    id: "no-transition-all",
    severity: "error",
    why: "Enumerate exact properties; `transition: all` lets unrelated changes animate.",
    test: (l) => /transition(-property)?\s*:\s*[^;]*\ball\b/.test(l),
  },
  {
    id: "no-scale-zero",
    severity: "error",
    why: "Never animate from scale(0) — start at scale(0.95)+ with opacity.",
    test: (l) =>
      /(@starting-style|data-mounted|from\s*\{|0%\s*\{|\[data-[^\]]*\])/.test(l) === false &&
      false, // handled by multiline scan below; keep single-line off
  },
  {
    id: "no-ease-in",
    severity: "error",
    why: "ease-in delays the first frame and feels sluggish; use --ease-out.",
    // bare `ease-in` as a timing function (not ease-in-out, not a token, not a word in prose)
    test: (l) =>
      /(transition|animation)[^;]*\bease-in\b(?!-out)/.test(l) &&
      !/var\(--ease/.test(l),
  },
  {
    id: "no-raw-cubic-bezier",
    severity: "warn",
    why: "Reference an --ease-* token instead of hardcoding a curve (consistency).",
    test: (l) =>
      /cubic-bezier\(/.test(l) && !/--ease-[a-z]+\s*:/.test(l), // ok inside a token def
  },
  {
    id: "duration-over-300ms",
    severity: "warn",
    why: "UI animations should stay < 300ms (--duration-slow 320ms is the ceiling).",
    test: (l) => {
      if (!/(transition|animation)/.test(l)) return false;
      const ms = [...l.matchAll(/(\d{3,5})ms/g)].map((m) => +m[1]);
      const s = [...l.matchAll(/(\d+(?:\.\d+)?)s\b/g)].map((m) => +m[1] * 1000);
      return [...ms, ...s].some((d) => d > 360 && d < 100000); // ignore loops like 2000ms shimmer? flagged as warn
    },
  },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(p, out);
    } else if ([".css", ".tsx", ".ts"].includes(extname(p))) {
      out.push(p);
    }
  }
  return out;
}

function stripComments(src) {
  // crude: blank out /* */ and // and {/* jsx */} so prose doesn't false-flag
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/.*$/gm, (m, p1) => p1 + " ".repeat(Math.max(0, m.length - p1.length)));
}

const files = walk(SRC);
const findings = [];

for (const file of files) {
  const rel = relative(ROOT, file);
  if (ALLOWLIST.includes(rel)) continue;
  const raw = readFileSync(file, "utf8");
  const clean = stripComments(raw);
  const lines = clean.split("\n");

  // multiline: flag `transform: scale(0)` used as an animation START state.
  lines.forEach((line, i) => {
    if (/transform\s*:\s*scale\(\s*0\s*\)/.test(line)) {
      findings.push({ rel, ln: i + 1, id: "no-scale-zero", severity: "error", text: line.trim(), why: "Never animate from scale(0) — start at scale(0.95)+ with opacity." });
    }
    for (const rule of RULES) {
      if (rule.id === "no-scale-zero") continue;
      if (rule.test(line)) {
        findings.push({ rel, ln: i + 1, id: rule.id, severity: rule.severity, text: line.trim(), why: rule.why });
      }
    }
  });
}

const errors = findings.filter((f) => f.severity === "error");
const warns = findings.filter((f) => f.severity === "warn");

if (findings.length === 0) {
  console.log("✓ motion-lint: no violations found across " + files.length + " files.");
  process.exit(0);
}

const byFile = {};
for (const f of findings) (byFile[f.rel] ??= []).push(f);
for (const [rel, list] of Object.entries(byFile)) {
  console.log("\n" + rel);
  for (const f of list) {
    const tag = f.severity === "error" ? "✗ ERROR" : "⚠ warn ";
    console.log(`  ${tag} [${f.id}] L${f.ln}: ${f.text.slice(0, 100)}`);
    console.log(`          → ${f.why}`);
  }
}

console.log(`\nmotion-lint: ${errors.length} error(s), ${warns.length} warning(s). See documents/motion.md.`);
process.exit(errors.length > 0 || (STRICT && warns.length > 0) ? 1 : 0);
