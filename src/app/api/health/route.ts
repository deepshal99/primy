/**
 * GET /api/health — lightweight liveness probe for uptime monitors
 * (BetterStack / UptimeRobot). No DB hit; just confirms the app is serving.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ok: true, ts: Date.now() });
}
