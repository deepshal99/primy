import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { getModelForTask, getProvider } from "@/lib/ai/modelRouter";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";

const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY! });
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function getModel() {
  const { model: modelId } = getModelForTask("title");
  return getProvider() === "openai" ? openai(modelId) : google(modelId);
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(`${session.user.id}:title`, 20, 60_000);
    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { userMessage, assistantMessage, includeProjectDetails } = body;

    if (!userMessage || !assistantMessage) {
      return Response.json({ error: "userMessage and assistantMessage are required" }, { status: 400 });
    }

    if (includeProjectDetails) {
      const { text } = await generateText({
        model: getModel(),
        prompt: `Based on this conversation, generate project metadata. Return ONLY valid JSON with these exact keys:
{
  "title": "short project name, 3-6 words, no quotes or trailing punctuation",
  "description": "one sentence describing what this project is about, 10-20 words",
  "projectType": "one of: Marketing, Content, Research, Engineering, Design, Other"
}

User: ${userMessage}
Assistant: ${assistantMessage}

Return ONLY the JSON object, no markdown fences, no explanation.`,
      });

      const raw = text.trim();
      try {
        const parsed = JSON.parse(raw.replace(/```json?\s*/g, "").replace(/```/g, "").trim());
        return Response.json({
          title: (parsed.title || "New Project").replace(/^["']|["']$/g, "").replace(/\.+$/, ""),
          description: parsed.description || null,
          projectType: ["Marketing", "Content", "Research", "Engineering", "Design", "Other"].includes(parsed.projectType)
            ? parsed.projectType
            : null,
        });
      } catch {
        const title = raw.replace(/^["']|["']$/g, "").replace(/\.+$/, "") || "New Project";
        return Response.json({ title, description: null, projectType: null });
      }
    }

    // Legacy: title-only generation
    const { text } = await generateText({
      model: getModel(),
      prompt: `Generate a very short title (4-6 words max) for a conversation that starts with this exchange. Return ONLY the title text, nothing else. No quotes, no punctuation at the end.

User: ${userMessage}
Assistant: ${assistantMessage}`,
    });

    const title = text.trim().replace(/^["']|["']$/g, "").replace(/\.+$/, "") || "New Chat";

    return Response.json({ title });
  } catch (error) {
    console.error("[Drafta] Title generation error:", error);
    return Response.json({ title: "New Project", description: null, projectType: null });
  }
}
