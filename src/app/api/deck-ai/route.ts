import { auth } from "@/lib/auth";
import { buildKimiSystemPrompt, buildKimiUserPrompt } from "@/lib/ai/kimiDeckPrompt";
import "@/lib/env";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { prompt, slideCount = 8 } = body as {
      prompt: string;
      slideCount?: number;
    };

    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = process.env.NVIDIA_NIM_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "NVIDIA NIM API key not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const systemPrompt = buildKimiSystemPrompt();
    const userPrompt = buildKimiUserPrompt(prompt, Math.min(Math.max(slideCount, 3), 15));

    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "moonshotai/kimi-k2.5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 16384,
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("NVIDIA NIM API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI generation failed", details: errorText }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Stream SSE back to client - forward the raw stream and let client parse slides
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    let fullContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  fullContent += content;

                  // Check if we have a new complete slide
                  const slides = extractSlides(fullContent);

                  // Send progress with slide count
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: "progress", slideCount: slides.length, partial: content })}\n\n`)
                  );
                }
              } catch {
                // Skip malformed JSON chunks
              }
            }
          }

          // Send final result with all extracted slides
          const finalSlides = extractSlides(fullContent);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "complete", slides: finalSlides, totalSlides: finalSlides.length })}\n\n`)
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (err) {
          console.error("Stream error:", err);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", message: "Stream interrupted" })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("deck-ai error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/** Extract complete slide HTML blocks from the accumulated content */
function extractSlides(content: string): string[] {
  const slides: string[] = [];
  // Match slide delimiters: <!-- SLIDE N: ... -->
  const parts = content.split(/<!--\s*SLIDE\s+\d+\s*:\s*[^>]*-->/i);

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    // Check if slide has a closing </div> — means it's complete
    // Find the outermost slide div
    let html = part;

    // Check if the next delimiter exists (meaning this slide is complete)
    const nextDelimiterExists = i < parts.length - 1;

    if (nextDelimiterExists) {
      // This slide is definitely complete
      slides.push(cleanSlideHtml(html));
    } else {
      // Last chunk — only include if it looks complete (has closing tag)
      const openDivs = (html.match(/<div[\s>]/gi) || []).length;
      const closeDivs = (html.match(/<\/div>/gi) || []).length;
      if (openDivs > 0 && openDivs <= closeDivs) {
        slides.push(cleanSlideHtml(html));
      }
    }
  }

  return slides;
}

function cleanSlideHtml(html: string): string {
  // Remove any trailing content after the last closing </div> of the slide
  let depth = 0;
  let lastClose = -1;
  const divOpenRegex = /<div[\s>]/gi;
  const divCloseRegex = /<\/div>/gi;

  let match;
  while ((match = divOpenRegex.exec(html)) !== null) {
    depth++;
  }

  depth = 0;
  let closeCount = 0;
  const targetCloses = (html.match(/<div[\s>]/gi) || []).length;

  while ((match = divCloseRegex.exec(html)) !== null) {
    closeCount++;
    if (closeCount === targetCloses) {
      lastClose = match.index + match[0].length;
      break;
    }
  }

  if (lastClose > 0) {
    html = html.slice(0, lastClose);
  }

  return html.trim();
}
