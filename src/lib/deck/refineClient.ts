/**
 * Client helper for POST /api/deck-refine. Streams Server-Sent progress events
 * and resolves with the final refined slides + summary.
 *
 *   refineDeckSlides(slides)
 *      ├─ filter to HTML slides (only those can be rendered/critiqued)
 *      ├─ POST { slides:[{id,html}], brandContext }
 *      ├─ read SSE: {stage:"render"|"critique"|"repair"} → onProgress
 *      └─ resolve { slides:[{id,html}], summary }   (or throw on {type:"error"})
 */
import { isHtmlSlide, type DeckSlide, type HtmlDeckSlide } from "@/lib/types";

export interface RefineProgressEvent {
  stage: "render" | "critique" | "repair" | "done";
  id?: string;
  index?: number;
  total?: number;
  score?: number;
  round?: number;
  summary?: RefineSummary;
}

export interface RefineSummary {
  critiqued: number;
  repaired: number;
  skipped: number;
  avgBefore: number;
  avgAfter: number;
}

export interface RefineClientResult {
  slides: { id: string; html: string }[];
  summary: RefineSummary;
}

/**
 * Run the polish pass over a deck's HTML slides. Returns null when there are no
 * HTML slides to refine. Throws on transport/server error.
 */
export async function refineDeckSlides(
  slides: (DeckSlide | HtmlDeckSlide)[],
  opts: {
    brandContext?: string;
    /** Background auto-polish after generation — not metered against the user's plan. */
    auto?: boolean;
    signal?: AbortSignal;
    onProgress?: (e: RefineProgressEvent) => void;
  } = {}
): Promise<RefineClientResult | null> {
  const htmlSlides = slides
    .filter(isHtmlSlide)
    .map((s) => ({ id: s.id, html: s.html }));
  if (htmlSlides.length === 0) return null;

  const res = await fetch("/api/deck-refine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slides: htmlSlides, brandContext: opts.brandContext, auto: opts.auto === true }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    let message = "Slide polish failed.";
    try {
      const j = await res.json();
      if (j?.error) message = j.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: RefineClientResult | null = null;
  let errorMessage: string | null = null;

  // Parse the SSE stream: events are separated by a blank line; each carries a
  // single `data: <json>` line.
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      const dataLine = rawEvent.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      let payload: unknown;
      try {
        payload = JSON.parse(dataLine.slice(5).trim());
      } catch {
        continue;
      }

      const obj = payload as Record<string, unknown>;
      if (obj.type === "result") {
        result = { slides: obj.slides as RefineClientResult["slides"], summary: obj.summary as RefineSummary };
      } else if (obj.type === "error") {
        errorMessage = typeof obj.error === "string" ? obj.error : "Slide polish failed.";
      } else if (typeof obj.stage === "string") {
        opts.onProgress?.(obj as unknown as RefineProgressEvent);
      }
    }
  }

  if (errorMessage) throw new Error(errorMessage);
  return result;
}
