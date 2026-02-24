import { GoogleGenAI } from "@google/genai";
import { auth } from "@/lib/auth";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userMessage, assistantMessage, includeProjectDetails } = await req.json();

    if (includeProjectDetails) {
      // Generate title + description + project type in one call
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Based on this conversation, generate project metadata. Return ONLY valid JSON with these exact keys:
{
  "title": "short project name, 3-6 words, no quotes or trailing punctuation",
  "description": "one sentence describing what this project is about, 10-20 words",
  "projectType": "one of: Marketing, Content, Research, Engineering, Design, Other"
}

User: ${userMessage}
Assistant: ${assistantMessage}

Return ONLY the JSON object, no markdown fences, no explanation.`,
              },
            ],
          },
        ],
      });

      const raw = response.text?.trim() || "";
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
        // Fallback: treat entire response as title
        const title = raw.replace(/^["']|["']$/g, "").replace(/\.+$/, "") || "New Project";
        return Response.json({ title, description: null, projectType: null });
      }
    }

    // Legacy: title-only generation for non-project conversations
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Generate a very short title (4-6 words max) for a conversation that starts with this exchange. Return ONLY the title text, nothing else. No quotes, no punctuation at the end.

User: ${userMessage}
Assistant: ${assistantMessage}`,
            },
          ],
        },
      ],
    });

    const title = response.text?.trim().replace(/^["']|["']$/g, "").replace(/\.+$/, "") || "New Chat";

    return Response.json({ title });
  } catch (error) {
    console.error("[Drafta] Title generation error:", error);
    return Response.json({ title: null });
  }
}
