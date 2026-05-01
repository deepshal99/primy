import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { generateText } from "ai";
import { getModel } from "@/lib/ai/modelRouter";
import "@/lib/env";

function getSummarizeModel() {
  return getModel("summarize");
}

async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  const { extractText } = await import("unpdf");
  const result = await extractText(new Uint8Array(buffer));
  return (result.text || []).join("\n");
}

// Supported text extensions inside zip files
const ZIP_TEXT_EXTENSIONS = new Set([
  ".txt", ".csv", ".md", ".json", ".js", ".ts", ".tsx", ".jsx",
  ".py", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".hpp",
  ".css", ".scss", ".html", ".xml", ".yaml", ".yml", ".toml",
  ".sh", ".bash", ".zsh", ".env", ".gitignore", ".dockerfile",
  ".sql", ".graphql", ".prisma", ".swift", ".kt", ".r", ".lua",
  ".php", ".vue", ".svelte", ".astro", ".mdx",
  ".cfg", ".ini", ".conf", ".properties", ".log",
]);

const ZIP_SKIP_DIRS = new Set([
  "node_modules/", ".git/", "__pycache__/", ".next/", "dist/", "build/",
  ".venv/", "venv/", ".idea/", ".vscode/", ".DS_Store",
]);

function isTextFile(filename: string): boolean {
  const ext = "." + (filename.split(".").pop()?.toLowerCase() || "");
  if (ZIP_TEXT_EXTENSIONS.has(ext)) return true;
  // Also accept extensionless files that look like config (Makefile, Dockerfile, etc.)
  const base = filename.split("/").pop() || "";
  if (!base.includes(".")) {
    return ["makefile", "dockerfile", "rakefile", "gemfile", "procfile", "readme", "license", "changelog"].includes(base.toLowerCase());
  }
  return false;
}

function shouldSkip(filepath: string): boolean {
  const lower = filepath.toLowerCase();
  for (const dir of ZIP_SKIP_DIRS) {
    if (lower.includes(dir)) return true;
  }
  return false;
}

async function extractZipContents(buffer: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);

  const parts: string[] = [];
  const fileList: string[] = [];
  let totalChars = 0;
  const MAX_TOTAL = 200000; // 200k chars total across all files

  // Collect and sort file paths
  const entries: { path: string; file: any }[] = [];
  zip.forEach((relativePath, file) => {
    if (!file.dir && !shouldSkip(relativePath)) {
      entries.push({ path: relativePath, file });
    }
  });
  entries.sort((a, b) => a.path.localeCompare(b.path));

  // Build file tree overview
  fileList.push(`=== ZIP CONTENTS (${entries.length} files) ===`);
  for (const { path } of entries) {
    fileList.push(path);
  }
  parts.push(fileList.join("\n"));
  parts.push("\n\n=== FILE CONTENTS ===\n");

  // Extract text contents
  for (const { path, file } of entries) {
    if (totalChars >= MAX_TOTAL) {
      parts.push(`\n... (truncated, ${entries.length - parts.length} more files)`);
      break;
    }

    if (isTextFile(path)) {
      try {
        const content = await file.async("string");
        const truncated = content.slice(0, Math.min(10000, MAX_TOTAL - totalChars));
        parts.push(`\n--- ${path} ---\n${truncated}`);
        totalChars += truncated.length;
        if (content.length > truncated.length) {
          parts.push(`\n... (truncated at ${truncated.length}/${content.length} chars)`);
        }
      } catch {
        parts.push(`\n--- ${path} --- [binary or unreadable]`);
      }
    } else if (path.endsWith(".pdf")) {
      try {
        const pdfBuffer = Buffer.from(await file.async("arraybuffer"));
        const pdfText = await parsePdfBuffer(pdfBuffer);
        const truncated = pdfText.slice(0, Math.min(10000, MAX_TOTAL - totalChars));
        parts.push(`\n--- ${path} ---\n${truncated}`);
        totalChars += truncated.length;
      } catch {
        parts.push(`\n--- ${path} --- [failed to extract PDF]`);
      }
    } else if (path.endsWith(".docx")) {
      try {
        const docxBuffer = Buffer.from(await file.async("arraybuffer"));
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer: docxBuffer });
        const truncated = result.value.slice(0, Math.min(10000, MAX_TOTAL - totalChars));
        parts.push(`\n--- ${path} ---\n${truncated}`);
        totalChars += truncated.length;
      } catch {
        parts.push(`\n--- ${path} --- [failed to extract DOCX]`);
      }
    }
  }

  return parts.join("");
}

const SUMMARY_THRESHOLD = 50000; // Only summarize files > 50K chars

async function summarizeLargeDocument(text: string): Promise<{ summary: string; keyPoints: string[] }> {
  try {
    const { text: raw } = await generateText({
      model: getSummarizeModel(),
      maxOutputTokens: 4096,
      prompt: `Analyze this document and provide:
1. A comprehensive summary (2-3 paragraphs)
2. Key points as a bullet list (5-10 items)

Return ONLY valid JSON:
{
  "summary": "...",
  "keyPoints": ["point 1", "point 2", ...]
}

Document:
${text.slice(0, 500000)}`,
    });

    const parsed = JSON.parse(raw.trim().replace(/```json?\s*/g, "").replace(/```/g, "").trim());
    return {
      summary: parsed.summary || "",
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
    };
  } catch (error) {
    console.error("[Extract API] Summarization error:", error);
    return { summary: "", keyPoints: [] };
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit(`${session.user.id}:extract`, 10, 60_000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Reject files over 100MB
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum size is 100MB." }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      try {
        text = await parsePdfBuffer(buffer);
      } catch (err) {
        console.error("[Extract API] PDF parse error:", err);
        return NextResponse.json(
          { error: "Failed to parse PDF. The file may be corrupt or password-protected." },
          { status: 422 }
        );
      }
    } else if (
      file.type.includes("wordprocessingml") ||
      file.name.endsWith(".docx")
    ) {
      try {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } catch (err) {
        console.error("[Extract API] DOCX parse error:", err);
        return NextResponse.json(
          { error: "Failed to parse DOCX. The file may be corrupt." },
          { status: 422 }
        );
      }
    } else if (
      file.type.includes("spreadsheetml") ||
      file.type === "application/vnd.ms-excel" ||
      file.name.endsWith(".xlsx") ||
      file.name.endsWith(".xls")
    ) {
      try {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const parts: string[] = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          parts.push(`Sheet: ${sheetName}\n${csv}`);
        }
        text = parts.join("\n\n");
      } catch (err) {
        console.error("[Extract API] XLSX parse error:", err);
        return NextResponse.json(
          { error: "Failed to parse spreadsheet. The file may be corrupt." },
          { status: 422 }
        );
      }
    } else if (
      file.type === "application/zip" ||
      file.type === "application/x-zip-compressed" ||
      file.name.endsWith(".zip")
    ) {
      try {
        text = await extractZipContents(buffer);
      } catch (err) {
        console.error("[Extract API] ZIP parse error:", err);
        return NextResponse.json(
          { error: "Failed to extract ZIP. The file may be corrupt." },
          { status: 422 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Use PDF, DOCX, XLSX, or ZIP." },
        { status: 400 }
      );
    }

    // Truncate to 200k chars
    text = text.slice(0, 200000);

    // AI summarization for large documents
    if (text.length > SUMMARY_THRESHOLD) {
      const { summary, keyPoints } = await summarizeLargeDocument(text);
      return NextResponse.json({ text, summary, keyPoints });
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error("[Extract API] Error:", error instanceof Error ? error.message : error);
    console.error("[Extract API] Stack:", error instanceof Error ? error.stack : "no stack");
    return NextResponse.json(
      { error: "Failed to extract text from file" },
      { status: 500 }
    );
  }
}
