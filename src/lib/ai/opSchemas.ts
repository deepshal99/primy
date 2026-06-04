/**
 * opSchemas — zod validation for AI-emitted operations, at the right altitude.
 *
 * WHY THIS EXISTS
 * The op boundary was `any`-typed end to end: `parseAIResponse` recovered raw
 * JSON, cast it to the op union, and handed it to the store. The types lied
 * exactly where failures happen — a deck slide missing `html`, a page UPDATE
 * with no `pageId`, an op with a bogus `type` — all sailed past `tsc` and only
 * surfaced at runtime as a confusing no-op. (See the memory'd `AI_DownloadError`
 * deck gotcha: "tsc passes either way; ONLY a live run catches it.")
 *
 * DESIGN — GATE, DON'T TRANSFORM
 * These schemas validate the discriminator and the fields the STORE actually
 * dereferences (the id on UPDATE/DELETE/RENAME, the title/html on CREATE). They
 * deliberately do NOT enumerate every nested shape — the parser's existing
 * normalization (normalizeHtmlSlide, validateThemeConfig, celldata coercion)
 * owns deep coercion, and over-strict schemas would reject currently-valid ops
 * (a regression). On success we keep the ORIGINAL op object (not zod's parsed
 * copy), so nothing is stripped. Invalid ops are dropped — as they effectively
 * were before — but now LOUDLY, via the opParseFailures sink.
 *
 * Unknown keys: zod object schemas strip-not-error by default, so extra fields
 * the model adds never cause a rejection.
 */

import { z } from "zod";
import {
  reportOpParseFailure,
  type OpFamily,
} from "./opParseFailures";

// A non-empty discriminator is the one thing every op must have.
const typeStr = z.string().min(1);

// ── sheetops (cell-level edits; sheetIndex-addressed) ──
const sheetOpSchema = z
  .object({ type: typeStr, sheetIndex: z.number().optional() })
  .refine(
    (o) =>
      [
        "SET_SHEET_DATA",
        "ADD_SHEET",
        "UPDATE_CELLS",
        "FORMAT_CELLS",
        "SET_COLUMN_WIDTHS",
        "DELETE_ROWS",
        "DELETE_COLUMNS",
        "SORT",
        "SET_DROPDOWN",
        "INSERT_IMAGE",
      ].includes(o.type),
    { message: "unknown sheetops type" },
  );

// ── docops (active-doc mutations) ──
const docOpSchema = z
  .object({ type: typeStr })
  .refine(
    (o) => ["SET_CONTENT", "APPEND_CONTENT", "REPLACE_SECTION"].includes(o.type),
    { message: "unknown docops type" },
  );

// ── kuops (knowledge-unit CRUD) ──
const kuOpSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("CREATE"), title: z.string(), content: z.string() }),
  z.object({ type: z.literal("UPDATE"), kuId: z.string().min(1), content: z.string() }),
  z.object({ type: z.literal("APPEND"), kuId: z.string().min(1), content: z.string() }),
  z.object({ type: z.literal("RENAME"), kuId: z.string().min(1), title: z.string() }),
  z.object({ type: z.literal("DELETE"), kuId: z.string().min(1) }),
]);

// ── tableops (full-table CRUD) ──
const tableOpSchema = z.discriminatedUnion("type", [
  // celldata is coerced to [] by the parser before validation, so array-presence
  // is enough; cell internals are normalized downstream.
  z.object({ type: z.literal("CREATE"), title: z.string(), celldata: z.array(z.any()) }),
  z.object({ type: z.literal("UPDATE_CELLS"), tableId: z.string().min(1), cells: z.array(z.any()) }),
  z.object({ type: z.literal("SET_TABLE_DATA"), tableId: z.string().min(1) }),
  z.object({ type: z.literal("DELETE"), tableId: z.string().min(1) }),
]);

// ── deckops (slide decks; slides already normalized by the parser) ──
const deckOpSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("CREATE"), title: z.string(), slides: z.array(z.any()) }),
  z.object({ type: z.literal("UPDATE"), deckId: z.string().min(1), slides: z.array(z.any()) }),
  z.object({ type: z.literal("DELETE"), deckId: z.string().min(1) }),
  z.object({ type: z.literal("RENAME"), deckId: z.string().min(1), title: z.string() }),
]);

// ── pageops (HTML pages) ──
const pageOpSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("CREATE"), title: z.string(), html: z.string().min(1) }),
  z.object({ type: z.literal("UPDATE"), pageId: z.string().min(1), html: z.string().min(1) }),
  z.object({ type: z.literal("RENAME"), pageId: z.string().min(1), title: z.string() }),
  z.object({ type: z.literal("DELETE"), pageId: z.string().min(1) }),
]);

const SCHEMAS: Record<OpFamily, z.ZodTypeAny> = {
  sheetops: sheetOpSchema,
  docops: docOpSchema,
  kuops: kuOpSchema,
  tableops: tableOpSchema,
  deckops: deckOpSchema,
  pageops: pageOpSchema,
};

/**
 * Validate a family's already-parsed ops. Returns only the ops that pass their
 * schema, keeping each ORIGINAL object (no stripping). Every rejection is
 * reported to the opParseFailures sink with a structural reason, converting a
 * silent runtime drop into an observable, named failure.
 */
export function validateOps<T>(family: OpFamily, rawOps: unknown[]): T[] {
  const schema = SCHEMAS[family];
  const valid: T[] = [];
  for (const op of rawOps) {
    const res = schema.safeParse(op);
    if (res.success) {
      valid.push(op as T); // keep the original — schema is a gate, not a transform
    } else {
      const reason =
        res.error.issues.some((i) => i.code === "invalid_type") &&
        res.error.issues.some((i) => i.path.length > 0)
          ? "missing-required-field"
          : "schema-invalid";
      reportOpParseFailure({
        family,
        reason: reason as "missing-required-field" | "schema-invalid",
        sample: safeSample(op),
      });
    }
  }
  return valid;
}

function safeSample(op: unknown): string {
  try {
    return typeof op === "string" ? op : JSON.stringify(op);
  } catch {
    return String(op);
  }
}
