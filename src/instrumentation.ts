/**
 * Next.js instrumentation hooks (loaded once per server boot).
 *
 * `onRequestError` is the single funnel for EVERY unhandled server error —
 * route handlers, server components, middleware. Each one becomes a structured
 * JSON log line (queryable in Vercel logs / any drain). When SENTRY_DSN is
 * configured this is also the right place to forward to Sentry; until then the
 * structured log IS the error reporting.
 */

export async function register() {
  // Runtime env validation runs on import (fail fast on misconfiguration).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/env");
  }
}

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string }
) {
  const { log } = await import("./lib/log");
  log.error("unhandled", err, {
    path: request.path,
    method: request.method,
    route: context.routePath,
    routeType: context.routeType,
  });
}
