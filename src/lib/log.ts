/**
 * Structured logger for server code.
 *
 * In production every entry is a single JSON line, which Vercel's log pipeline
 * (and any log drain: Datadog, Axiom, Betterstack) indexes by field — so
 * "all errors on route X" is a query, not a grep. In dev it stays readable.
 *
 * Usage:
 *   import { log } from "@/lib/log";
 *   log.error("chat.stream", err, { userId, model });
 *   log.warn("billing.cap", "user at limit", { userId, plan });
 */

type Level = "error" | "warn" | "info";
type Fields = Record<string, unknown>;

function serializeError(err: unknown): Fields {
  if (err instanceof Error) {
    return { message: err.message, name: err.name, stack: err.stack?.split("\n").slice(0, 8).join("\n") };
  }
  return { message: String(err) };
}

function emit(level: Level, scope: string, msgOrErr: unknown, fields?: Fields) {
  const base: Fields = {
    level,
    scope,
    ts: new Date().toISOString(),
    ...(msgOrErr instanceof Error ? { err: serializeError(msgOrErr) } : { msg: String(msgOrErr) }),
    ...fields,
  };
  const line = process.env.NODE_ENV === "production" ? JSON.stringify(base) : `[${scope}] ${base.msg ?? (base.err as Fields | undefined)?.message ?? ""}`;
  if (level === "error") console.error(line, process.env.NODE_ENV !== "production" && msgOrErr instanceof Error ? msgOrErr : "");
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  error: (scope: string, msgOrErr: unknown, fields?: Fields) => emit("error", scope, msgOrErr, fields),
  warn: (scope: string, msgOrErr: unknown, fields?: Fields) => emit("warn", scope, msgOrErr, fields),
  info: (scope: string, msgOrErr: unknown, fields?: Fields) => emit("info", scope, msgOrErr, fields),
};
