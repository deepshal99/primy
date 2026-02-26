import { nanoid } from "nanoid";
import { FileAttachment } from "@/lib/types";

export const ACCEPTED_EXTENSIONS = [
  ".txt", ".csv", ".md", ".json",
  ".pdf", ".docx", ".xlsx", ".xls",
  ".png", ".jpg", ".jpeg", ".webp",
  ".zip",
];

export const ACCEPTED_MIME_TYPES: Record<string, string[]> = {
  "text/plain": [".txt"],
  "text/csv": [".csv"],
  "text/markdown": [".md"],
  "application/json": [".json"],
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "application/zip": [".zip"],
  "application/x-zip-compressed": [".zip"],
};

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_FILES_PER_MESSAGE = 10;

export function getFileCategory(file: File): FileAttachment["type"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf") return "pdf";
  if (file.type.includes("wordprocessingml") || file.name.endsWith(".docx")) return "docx";
  if (file.type.includes("spreadsheetml") || file.type === "application/vnd.ms-excel" || file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) return "pdf";
  if (file.type === "application/zip" || file.type === "application/x-zip-compressed" || file.name.endsWith(".zip")) return "zip";
  return "text";
}

export function isAcceptedFile(file: File): boolean {
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(ext);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function createAttachmentFromFile(file: File): FileAttachment {
  const category = getFileCategory(file);
  return {
    id: nanoid(),
    name: file.name,
    type: category,
    mimeType: file.type,
    size: file.size,
    isExtracting: true,
  };
}

/** Compress an image file via canvas (max 1200px, JPEG 0.8 quality) */
function compressImage(file: File, maxDim = 1200, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    img.src = url;
  });
}

/** Convert file to base64 data (without the data:xxx;base64, prefix) */
export function fileToBase64(file: File): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      // Compress images before encoding to keep payloads small
      let blob: Blob = file;
      if (file.type.startsWith("image/") && file.size > 500 * 1024) {
        blob = await compressImage(file);
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    } catch (err) {
      reject(err);
    }
  });
}

/** Create an object URL for image preview */
export function createImagePreview(file: File): string {
  return URL.createObjectURL(file);
}

/** Extract text from a text-based file (txt, csv, md, json) client-side */
export async function extractTextFile(file: File): Promise<string> {
  const text = await file.text();
  // For CSV, format as readable text
  if (file.type === "text/csv" || file.name.endsWith(".csv")) {
    try {
      const Papa = (await import("papaparse")).default;
      const parsed = Papa.parse(text, { header: true });
      return JSON.stringify(parsed.data.slice(0, 500), null, 2);
    } catch {
      return text.slice(0, 200000);
    }
  }
  return text.slice(0, 200000);
}

/** Extract text from PDF/DOCX via server-side API */
export async function extractViaServer(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/extract", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Extraction failed: ${response.status}`);
  }

  const result = await response.json();
  return result.text || "";
}

/** Process a file and return updated attachment data */
export async function processFile(
  file: File,
  attachment: FileAttachment
): Promise<Partial<FileAttachment>> {
  const category = attachment.type;

  switch (category) {
    case "text": {
      const text = await extractTextFile(file);
      return { extractedText: text, isExtracting: false };
    }
    case "image": {
      const [base64, previewUrl] = await Promise.all([
        fileToBase64(file),
        Promise.resolve(createImagePreview(file)),
      ]);
      return { base64, previewUrl, isExtracting: false };
    }
    case "pdf":
    case "docx":
    case "zip": {
      const text = await extractViaServer(file);
      return { extractedText: text, isExtracting: false };
    }
    default:
      return { isExtracting: false };
  }
}

/** Get the accept string for file input */
export function getAcceptString(): string {
  return Object.entries(ACCEPTED_MIME_TYPES)
    .map(([mime, exts]) => [mime, ...exts].join(","))
    .join(",");
}
