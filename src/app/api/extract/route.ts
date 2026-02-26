import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

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
  const MAX_TOTAL = 100000; // 100k chars total across all files

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
        const pdfParseModule = await import("pdf-parse");
        const pdfParse = (pdfParseModule as any).default || pdfParseModule;
        const result = await pdfParse(pdfBuffer);
        const truncated = result.text.slice(0, Math.min(10000, MAX_TOTAL - totalChars));
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

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      const pdfParseModule = await import("pdf-parse");
      const pdfParse = (pdfParseModule as any).default || pdfParseModule;
      const result = await pdfParse(buffer);
      text = result.text;
    } else if (
      file.type.includes("wordprocessingml") ||
      file.name.endsWith(".docx")
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (
      file.type === "application/zip" ||
      file.type === "application/x-zip-compressed" ||
      file.name.endsWith(".zip")
    ) {
      text = await extractZipContents(buffer);
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Use PDF, DOCX, or ZIP." },
        { status: 400 }
      );
    }

    // Truncate to 100k chars (increased for zip files with multiple documents)
    text = text.slice(0, 100000);

    return NextResponse.json({ text });
  } catch (error) {
    console.error("[Extract API] Error:", error);
    return NextResponse.json(
      { error: "Failed to extract text from file" },
      { status: 500 }
    );
  }
}
