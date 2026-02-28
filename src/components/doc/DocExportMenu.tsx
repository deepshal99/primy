"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Download, FileText, Copy, ChevronDown, FileDown, FileType } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";

function getEntityTitle(): string {
  const state = useAppStore.getState();
  if (state.currentEntityId && state.currentProjectId) {
    const project = state.projects.find((p) => p.id === state.currentProjectId);
    if (project) {
      const ku = project.knowledgeUnits.find((k) => k.id === state.currentEntityId);
      if (ku) return ku.title.replace(/[/\\?%*:|"<>]/g, "_") || "document";
    }
  }
  return "document";
}

/** Parse markdown bold/italic/code inline formatting into TextRun array */
function parseInlineFormatting(TextRun: any, text: string): any[] {
  const runs: any[] = [];
  // Match **bold**, *italic*, `code`, and plain text
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+))/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      runs.push(new TextRun({ text: match[2], bold: true }));
    } else if (match[3]) {
      runs.push(new TextRun({ text: match[3], italics: true }));
    } else if (match[4]) {
      runs.push(new TextRun({ text: match[4], font: "Courier New", size: 20 }));
    } else if (match[5]) {
      runs.push(new TextRun({ text: match[5] }));
    }
  }
  return runs.length > 0 ? runs : [new TextRun({ text })];
}

export function DocExportMenu() {
  const [open, setOpen] = useState(false);
  const docContent = useAppStore((s) => s.docContent);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const hasContent = docContent.length > 0;

  const downloadPDF = useCallback(async () => {
    const title = getEntityTitle();

    // Convert markdown to styled HTML for server-side PDF rendering
    const lines = docContent.split("\n");
    const htmlParts: string[] = [];
    for (const line of lines) {
      // Apply inline formatting
      const fmt = (t: string) =>
        t.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.*?)\*/g, "<em>$1</em>")
          .replace(/`(.*?)`/g, '<code style="background:#f3f4f6;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:0.9em">$1</code>');

      if (line.startsWith("# ")) {
        htmlParts.push(`<h1 style="font-size:24px;font-weight:700;margin:18px 0 8px;font-family:'DM Sans',sans-serif">${fmt(line.slice(2))}</h1>`);
      } else if (line.startsWith("## ")) {
        htmlParts.push(`<h2 style="font-size:19px;font-weight:700;margin:14px 0 6px;font-family:'DM Sans',sans-serif">${fmt(line.slice(3))}</h2>`);
      } else if (line.startsWith("### ")) {
        htmlParts.push(`<h3 style="font-size:15px;font-weight:700;margin:10px 0 4px;font-family:'DM Sans',sans-serif">${fmt(line.slice(4))}</h3>`);
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        htmlParts.push(`<div style="display:flex;gap:8px;margin:2px 0;font-size:11pt;line-height:1.6"><span style="color:#999">&bull;</span><span>${fmt(line.slice(2))}</span></div>`);
      } else if (/^\d+\. /.test(line)) {
        const m = line.match(/^(\d+)\. (.*)/);
        if (m) htmlParts.push(`<div style="display:flex;gap:8px;margin:2px 0;font-size:11pt;line-height:1.6"><span style="min-width:20px">${m[1]}.</span><span>${fmt(m[2])}</span></div>`);
      } else if (line.startsWith("> ")) {
        htmlParts.push(`<blockquote style="border-left:3px solid #ddd;padding-left:12px;margin:6px 0;color:#666;font-style:italic;font-size:11pt">${fmt(line.slice(2))}</blockquote>`);
      } else if (line === "---") {
        htmlParts.push('<hr style="border:none;border-top:1px solid #e0e0e0;margin:10px 0">');
      } else if (line.trim() === "") {
        htmlParts.push('<div style="height:8px"></div>');
      } else {
        htmlParts.push(`<p style="font-size:11pt;line-height:1.6;margin:2px 0">${fmt(line)}</p>`);
      }
    }

    const html = htmlParts.join("\n");
    const css = `* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: 'DM Sans', -apple-system, sans-serif; color: #111; padding: 0.6in; }`;

    try {
      const res = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, css }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "PDF generation failed" }));
        throw new Error(err.error || "PDF generation failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Downloaded PDF");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate PDF");
    }
    setOpen(false);
  }, [docContent]);

  const downloadDocx = useCallback(async () => {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import("docx");

    const children: any[] = [];
    const lines = docContent.split("\n");

    for (const line of lines) {
      if (line.startsWith("# ")) {
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: parseInlineFormatting(TextRun, line.replace(/^# /, "")),
        }));
      } else if (line.startsWith("## ")) {
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: parseInlineFormatting(TextRun, line.replace(/^## /, "")),
        }));
      } else if (line.startsWith("### ")) {
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: parseInlineFormatting(TextRun, line.replace(/^### /, "")),
        }));
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        children.push(new Paragraph({
          bullet: { level: 0 },
          children: parseInlineFormatting(TextRun, line.replace(/^[-*] /, "")),
        }));
      } else if (/^\d+\. /.test(line)) {
        const text = line.replace(/^\d+\. /, "");
        children.push(new Paragraph({
          numbering: { reference: "default-numbering", level: 0 },
          children: parseInlineFormatting(TextRun, text),
        }));
      } else if (line.startsWith("> ")) {
        children.push(new Paragraph({
          indent: { left: 720 },
          children: [new TextRun({ text: line.replace(/^> /, ""), italics: true, color: "666666" })],
        }));
      } else if (line === "---") {
        children.push(new Paragraph({
          border: { bottom: { color: "CCCCCC", space: 1, style: "single" as any, size: 6 } },
          children: [new TextRun("")],
        }));
      } else if (line.trim() === "") {
        children.push(new Paragraph({ children: [] }));
      } else {
        children.push(new Paragraph({
          children: parseInlineFormatting(TextRun, line),
        }));
      }
    }

    const doc = new Document({
      numbering: {
        config: [{
          reference: "default-numbering",
          levels: [{ level: 0, format: "decimal" as any, text: "%1.", alignment: AlignmentType.START }],
        }],
      },
      sections: [{ children }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${getEntityTitle()}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
    toast.success("Downloaded DOCX");
  }, [docContent]);

  const downloadMarkdown = useCallback(() => {
    const blob = new Blob([docContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${getEntityTitle()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
    toast.success("Downloaded document.md");
  }, [docContent]);

  const copyToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(docContent);
    setOpen(false);
    toast.success("Copied to clipboard");
  }, [docContent]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={!hasContent}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${
          hasContent
            ? "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
            : "text-[var(--color-text-muted)] opacity-40 cursor-not-allowed"
        }`}
      >
        <Download className="w-3.5 h-3.5" />
        Export
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-48 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-lg z-50 overflow-hidden animate-fade-in">
          <button
            onClick={downloadDocx}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            <FileType className="w-4 h-4 text-blue-500" />
            Download DOCX
          </button>
          <div className="mx-3 border-t border-[var(--color-border)]" />
          <button
            onClick={downloadPDF}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            <FileDown className="w-4 h-4 text-red-500" />
            Download PDF
          </button>
          <div className="mx-3 border-t border-[var(--color-border)]" />
          <button
            onClick={downloadMarkdown}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            <FileText className="w-4 h-4 text-[var(--color-text-muted)]" />
            Download .md
          </button>
          <div className="mx-3 border-t border-[var(--color-border)]" />
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            <Copy className="w-4 h-4 text-[var(--color-text-muted)]" />
            Copy to clipboard
          </button>
        </div>
      )}
    </div>
  );
}
