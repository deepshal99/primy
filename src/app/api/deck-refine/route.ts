/**
 * POST /api/deck-refine — render→vision-critique→repair pass over a deck.
 *
 * Body: { slides: {id, html}[], brandContext?: string }
 * Response: Server-Sent Events stream of {@link RefineProgress} objects, then a
 * final `{ type: "result", slides, summary }` (or `{ type: "error", error }`).
 *
 * Runs OUT of the chat stream so the conversational flow is untouched. Reuses
 * the Puppeteer boot from PDF export and the OpenAI vision model already wired
 * for decks — no new provider. maxDuration is raised because rendering +
 * critiquing N slides with repair rounds is the cost center.
 */
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { resolveEffectivePlan, getUsage, incrementUsage } from "@/lib/billing";
import { PLAN_LIMITS, planLimitsEnforced } from "@/lib/plans";
import { refineDeck, type RefineSlide, type RefineProgress } from "@/lib/ai/deck/refineDeck";

export const maxDuration = 300;

/** Generous caps to bound memory/cost — a deck never legitimately exceeds these. */
const MAX_SLIDES = 40;
const MAX_HTML_BYTES = 256 * 1024; // per slide
const MAX_BRAND_CONTEXT = 2_000;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Refine is expensive (many model calls); throttle harder than chat.
  const rl = checkRateLimit(`${session.user.id}:deck-refine`, 6, 60_000);
  if (!rl.allowed) {
    return Response.json(
      { error: "Too many polish requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawSlides = (body as { slides?: unknown })?.slides;
  if (!Array.isArray(rawSlides) || rawSlides.length === 0) {
    return Response.json({ error: "slides array is required" }, { status: 400 });
  }
  if (rawSlides.length > MAX_SLIDES) {
    return Response.json({ error: `Too many slides (max ${MAX_SLIDES})` }, { status: 400 });
  }

  const slides: RefineSlide[] = [];
  for (const s of rawSlides) {
    if (!s || typeof s !== "object") continue;
    const id = (s as { id?: unknown }).id;
    const html = (s as { html?: unknown }).html;
    if (typeof id !== "string" || typeof html !== "string") continue;
    if (html.length > MAX_HTML_BYTES) {
      return Response.json({ error: "A slide exceeds the maximum size" }, { status: 400 });
    }
    slides.push({ id, html });
  }
  if (slides.length === 0) {
    return Response.json({ error: "No valid HTML slides to refine" }, { status: 400 });
  }

  const brandContextRaw = (body as { brandContext?: unknown })?.brandContext;
  const brandContext =
    typeof brandContextRaw === "string" ? brandContextRaw.slice(0, MAX_BRAND_CONTEXT) : undefined;

  // Metering: manual polish counts as one AI message. Background auto-polish
  // (auto:true) rides on the generation the user already paid for, so it's
  // free — only the explicit "Polish" button is metered.
  const isAuto = (body as { auto?: unknown })?.auto === true;
  if (!isAuto) {
    const plan = await resolveEffectivePlan(session.user.id);
    if (planLimitsEnforced()) {
      const usage = await getUsage(session.user.id);
      const limit = PLAN_LIMITS[plan].aiMessagesPerMonth;
      if (Number.isFinite(limit) && usage.aiMessages >= limit) {
        return Response.json(
          { error: "plan_limit_exceeded", plan, resource: "aiMessages", limit, used: usage.aiMessages },
          { status: 402 }
        );
      }
    }
    await incrementUsage(session.user.id, "aiMessages", 1);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          /* controller already closed — ignore */
        }
      };
      try {
        const result = await refineDeck(slides, {
          brandContext,
          onProgress: (e: RefineProgress) => send(e),
        });
        send({ type: "result", slides: result.slides, summary: result.summary });
      } catch (err) {
        console.error("[deck-refine] failed:", err);
        send({ type: "error", error: "Slide polish failed. Your slides are unchanged." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
