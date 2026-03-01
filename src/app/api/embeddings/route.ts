import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateEmbeddings } from "@/lib/ai/embeddings";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { texts } = body;

    if (!Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        { error: "texts must be a non-empty array of strings" },
        { status: 400 }
      );
    }

    if (texts.length > 20) {
      return NextResponse.json(
        { error: "Maximum 20 texts per request" },
        { status: 400 }
      );
    }

    if (!texts.every((t: unknown) => typeof t === "string")) {
      return NextResponse.json(
        { error: "All items in texts must be strings" },
        { status: 400 }
      );
    }

    const embeddings = await generateEmbeddings(texts);
    return NextResponse.json({ embeddings });
  } catch (error) {
    console.error("Embeddings API error:", error);
    return NextResponse.json(
      { error: "Failed to generate embeddings" },
      { status: 500 }
    );
  }
}
