"use client";

import { useCallback } from "react";
import { Download, FileText, FileDown, Copy } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

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

function parseInlineFormatting(TextRun: any, text: string): any[] {
  const runs: any[] = [];
  // Final `([*`])` branch consumes a lone, unmatched * or ` as literal text —
  // otherwise the catch-all `[^*`]+` skips it and the character is dropped
  // (e.g. the stray markers in `***bolditalic***`).
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+)|([*`]))/g;
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
    } else if (match[6]) {
      runs.push(new TextRun({ text: match[6] }));
    }
  }
  return runs.length > 0 ? runs : [new TextRun({ text })];
}

function markdownToHtml(docContent: string): string {
  const lines = docContent.split("\n");
  const htmlParts: string[] = [];
  for (const line of lines) {
    // Escape HTML special chars BEFORE inserting our own tags, so raw <, >, &
    // in the user's doc don't break the exported markup.
    const esc = (t: string) =>
      t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fmt = (t: string) =>
      esc(t)
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/`(.*?)`/g, '<code style="background:#f3f4f6;padding:1px 4px;border-radius:3px;font-family:monospace;font-size:0.9em">$1</code>');

    if (line.startsWith("# ")) {
      htmlParts.push(`<h1 style="font-size:24px;font-weight:700;margin:18px 0 8px;font-family:'Inter',sans-serif">${fmt(line.slice(2))}</h1>`);
    } else if (line.startsWith("## ")) {
      htmlParts.push(`<h2 style="font-size:19px;font-weight:700;margin:14px 0 6px;font-family:'Inter',sans-serif">${fmt(line.slice(3))}</h2>`);
    } else if (line.startsWith("### ")) {
      htmlParts.push(`<h3 style="font-size:15px;font-weight:700;margin:10px 0 4px;font-family:'Inter',sans-serif">${fmt(line.slice(4))}</h3>`);
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
  return htmlParts.join("\n");
}

export function DocExportMenu() {
  const docContent = useAppStore((s) => s.docContent);
  const hasContent = docContent.length > 0;

  const downloadPDF = useCallback(async () => {
    const title = getEntityTitle();
    const html = markdownToHtml(docContent);
    const css = `* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: 'Inter', -apple-system, sans-serif; color: #111; padding: 0.6in; }`;

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
  }, [docContent]);

  const downloadDocx = useCallback(async () => {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import("docx");

    const children: any[] = [];
    const lines = docContent.split("\n");

    for (const line of lines) {
      if (line.startsWith("# ")) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: parseInlineFormatting(TextRun, line.replace(/^# /, "")) }));
      } else if (line.startsWith("## ")) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: parseInlineFormatting(TextRun, line.replace(/^## /, "")) }));
      } else if (line.startsWith("### ")) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: parseInlineFormatting(TextRun, line.replace(/^### /, "")) }));
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        children.push(new Paragraph({ bullet: { level: 0 }, children: parseInlineFormatting(TextRun, line.replace(/^[-*] /, "")) }));
      } else if (/^\d+\. /.test(line)) {
        const text = line.replace(/^\d+\. /, "");
        children.push(new Paragraph({ numbering: { reference: "default-numbering", level: 0 }, children: parseInlineFormatting(TextRun, text) }));
      } else if (line.startsWith("> ")) {
        children.push(new Paragraph({ indent: { left: 720 }, children: [new TextRun({ text: line.replace(/^> /, ""), italics: true, color: "666666" })] }));
      } else if (line === "---") {
        children.push(new Paragraph({ border: { bottom: { color: "CCCCCC", space: 1, style: "single" as any, size: 6 } }, children: [new TextRun("")] }));
      } else if (line.trim() === "") {
        children.push(new Paragraph({ children: [] }));
      } else {
        children.push(new Paragraph({ children: parseInlineFormatting(TextRun, line) }));
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
    toast.success("Downloaded Markdown");
  }, [docContent]);

  const copyToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(docContent);
    toast.success("Copied to clipboard");
  }, [docContent]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={!hasContent}
          className="w-[30px] h-[30px] flex items-center justify-center rounded-lg text-icon hover:text-foreground hover:bg-accent active:scale-[0.95] transition-colors duration-150 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          title="Export"
        >
          <Download className="w-[14px] h-[14px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 p-1">
        <DropdownMenuItem onClick={downloadPDF} className="gap-2.5 px-2.5 py-1.5 rounded-md cursor-pointer">
          <FileDown className="w-3.5 h-3.5 text-[#eb3424] flex-shrink-0" />
          <span className="text-[12.5px]" style={{ fontWeight: 450 }}>PDF</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadDocx} className="gap-2.5 px-2.5 py-1.5 rounded-md cursor-pointer">
          <FileText className="w-3.5 h-3.5 text-[#2a6dfb] flex-shrink-0" />
          <span className="text-[12.5px]" style={{ fontWeight: 450 }}>Word (.docx)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadMarkdown} className="gap-2.5 px-2.5 py-1.5 rounded-md cursor-pointer">
          <FileText className="w-3.5 h-3.5 text-icon flex-shrink-0" />
          <span className="text-[12.5px]" style={{ fontWeight: 450 }}>Markdown</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem onClick={copyToClipboard} className="gap-2.5 px-2.5 py-1.5 rounded-md cursor-pointer">
          <Copy className="w-3.5 h-3.5 text-icon flex-shrink-0" />
          <span className="text-[12.5px]" style={{ fontWeight: 450 }}>Copy text</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
