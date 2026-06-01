import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { incrementUsage } from "@/lib/billing";
import { generateText } from "ai";
import { getModel } from "@/lib/ai/modelRouter";
import "@/lib/env";

// Vision OCR for image-based PDFs can take 30-50s; give the route room.
export const maxDuration = 120;

function getSummarizeModel() {
  return getModel("summarize");
}

async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  const { extractText } = await import("unpdf");
  const result = await extractText(new Uint8Array(buffer));
  return (result.text || []).join("\n");
}

/** True when extraction yielded essentially no readable text (image/scanned). */
function isLikelyEmpty(text: string): boolean {
  return text.replace(/\s+/g, "").length < 100;
}

/**
 * OCR fallback for image-based / scanned PDFs. unpdf's text extractor returns
 * (almost) nothing for these, so we hand the raw PDF to a vision model, which
 * reads the pages directly — no canvas/rendering deps. Bounded by size + tokens
 * to stay within the route's time budget. Returns "" on any failure.
 */
async function ocrPdfBuffer(buffer: Buffer): Promise<string> {
  // Vision input gets expensive/slow on huge PDFs; only OCR reasonable sizes.
  if (buffer.length > 20 * 1024 * 1024) return "";
  try {
    const { text } = await generateText({
      model: getModel("summarize"), // gpt-4.1 (vision-capable)
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "This PDF is image-based (scanned or exported slides) so its text layer is empty. Read the pages with vision and transcribe ALL readable text and data as clean plain text, in page order. Preserve tables as simple rows. No commentary, no markdown fences.",
            },
            { type: "file", mediaType: "application/pdf", data: new Uint8Array(buffer), filename: "document.pdf" },
          ],
        },
      ],
      maxOutputTokens: 8000,
    });
    return text || "";
  } catch (err) {
    console.error("[Extract API] PDF OCR fallback failed:", err instanceof Error ? err.message : err);
    return "";
  }
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

async function extractZipContents(buffer: Buffer): Promise<{ text: string; entryCount: number }> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);

  const parts: string[] = [];
  const fileList: string[] = [];
  let totalChars = 0;
  const MAX_TOTAL = 200000;            // 200k chars total across all files
  const MAX_ENTRIES = 2000;            // cap entries listed/processed
  const MAX_ENTRY_UNCOMPRESSED = 25 * 1024 * 1024; // 25MB/entry — bomb guard

  // Uncompressed size of a JSZip entry, when available. Used to skip
  // decompression bombs (tiny compressed → huge uncompressed) BEFORE we call
  // .async(), which would otherwise inflate the whole entry into memory.
  const uncompressedSize = (file: any): number =>
    typeof file?._data?.uncompressedSize === "number" ? file._data.uncompressedSize : 0;

  // Collect and sort file paths
  const entries: { path: string; file: any }[] = [];
  zip.forEach((relativePath, file) => {
    if (!file.dir && !shouldSkip(relativePath)) {
      entries.push({ path: relativePath, file });
    }
  });
  entries.sort((a, b) => a.path.localeCompare(b.path));
  // Hard cap on entry count (zip with 50k+ files → memory/time).
  const truncatedEntryList = entries.length > MAX_ENTRIES;
  if (truncatedEntryList) entries.length = MAX_ENTRIES;

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

    // Decompression-bomb guard: skip entries whose uncompressed size is huge
    // BEFORE decompressing them into memory.
    if (uncompressedSize(file) > MAX_ENTRY_UNCOMPRESSED) {
      parts.push(`\n--- ${path} --- [skipped: file too large]`);
      continue;
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

  return { text: parts.join(""), entryCount: entries.length };
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
    let ocrUsed = false;
    // For ZIPs, we increment fileUploads by the number of internal entries
    // (matches the user-facing "files uploaded" count). For all other
    // single-file requests, this stays at 1.
    let fileUploadsToCount = 1;

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
      // Image-based / scanned PDF → no text layer. Fall back to vision OCR so
      // the user isn't silently handed an empty file.
      if (isLikelyEmpty(text)) {
        const ocr = await ocrPdfBuffer(buffer);
        if (!isLikelyEmpty(ocr)) {
          text = ocr;
          ocrUsed = true;
        }
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
        const zipResult = await extractZipContents(buffer);
        text = zipResult.text;
        // Count internal ZIP entries as separate file uploads. Fall back
        // to 1 if the ZIP was empty so we still record the request.
        fileUploadsToCount = Math.max(1, zipResult.entryCount);
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

    // Increment fileUploads counter for billing/usage tracking. ZIPs count
    // each internal entry; non-ZIP requests count as 1. Storage cap will
    // be enforced on the dedicated upload path in v1.1 once blob upload
    // is wired to the files table.
    try {
      await incrementUsage(session.user.id, "fileUploads", fileUploadsToCount);
    } catch (err) {
      // Telemetry failure must not block the user-facing extraction.
      console.error("[Extract API] usage increment error:", err);
    }

    // Still no readable text (e.g. an image-only PDF where OCR also came up
    // empty, or an empty file) — tell the user instead of returning silence.
    if (isLikelyEmpty(text)) {
      return NextResponse.json({
        text: "",
        warning: "We couldn't read any text from this file. If it's a scanned or image-only document, the content may not be machine-readable.",
      });
    }

    // AI summarization for large documents
    if (text.length > SUMMARY_THRESHOLD) {
      const { summary, keyPoints } = await summarizeLargeDocument(text);
      return NextResponse.json({ text, summary, keyPoints, ocr: ocrUsed });
    }

    return NextResponse.json({ text, ocr: ocrUsed });
  } catch (error) {
    console.error("[Extract API] Error:", error instanceof Error ? error.message : error);
    console.error("[Extract API] Stack:", error instanceof Error ? error.stack : "no stack");
    return NextResponse.json(
      { error: "Failed to extract text from file" },
      { status: 500 }
    );
  }
}
