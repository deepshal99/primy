"use client";

import { useCallback } from "react";
import { Download, FileText, FileCode, FileType, FileDown, Copy, Code2 } from "lucide-react";
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

function markdownToHtml(docContent: string): string {
  const lines = docContent.split("\n");
  const htmlParts: string[] = [];
  for (const line of lines) {
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
  return htmlParts.join("\n");
}

export function DocExportMenu() {
  const docContent = useAppStore((s) => s.docContent);
  const hasContent = docContent.length > 0;

  const downloadHTML = useCallback(() => {
    const html = markdownToHtml(docContent);
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${getEntityTitle()}</title>
  <style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: 'DM Sans', -apple-system, sans-serif; color: #111; padding: 2rem; max-width: 800px; margin: 0 auto; }</style>
</head>
<body>${html}</body>
</html>`;
    const blob = new Blob([fullHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${getEntityTitle()}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded HTML");
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

  const downloadPlainText = useCallback(() => {
    const text = docContent
      .replace(/^#{1,6}\s/gm, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`(.*?)`/g, "$1")
      .replace(/^[-*]\s/gm, "- ")
      .replace(/^>\s/gm, "");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${getEntityTitle()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded Plain Text");
  }, [docContent]);

  const downloadPDF = useCallback(async () => {
    const title = getEntityTitle();
    const html = markdownToHtml(docContent);
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

  const copyToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(docContent);
    toast.success("Copied to clipboard");
  }, [docContent]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={!hasContent}
          className="w-[36px] h-[36px] flex items-center justify-center rounded-lg transition-colors text-[#95928E] hover:text-[#2d2e2e] hover:bg-[#efeee9] disabled:opacity-40 disabled:cursor-not-allowed"
          title="Export document"
        >
          <Download className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={downloadHTML} className="transition-transform duration-150 hover:translate-x-0.5">
          <FileCode className="w-4 h-4 text-muted-foreground" />
          <div>
            <div className="text-[13px]">HTML Document</div>
            <div className="text-[11px] text-muted-foreground">.html &mdash; Formatted document</div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadMarkdown} className="transition-transform duration-150 hover:translate-x-0.5">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <div>
            <div className="text-[13px]">Markdown</div>
            <div className="text-[11px] text-muted-foreground">.md &mdash; Lightweight markup</div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadPlainText} className="transition-transform duration-150 hover:translate-x-0.5">
          <FileType className="w-4 h-4 text-muted-foreground" />
          <div>
            <div className="text-[13px]">Plain Text</div>
            <div className="text-[11px] text-muted-foreground">.txt &mdash; No formatting</div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={downloadPDF} className="transition-transform duration-150 hover:translate-x-0.5">
          <FileDown className="w-4 h-4 text-red-500" />
          <div>
            <div className="text-[13px]">PDF Document</div>
            <div className="text-[11px] text-muted-foreground">.pdf &mdash; Print-ready</div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadDocx} className="transition-transform duration-150 hover:translate-x-0.5">
          <FileType className="w-4 h-4 text-blue-500" />
          <div>
            <div className="text-[13px]">Word Document</div>
            <div className="text-[11px] text-muted-foreground">.docx &mdash; Microsoft Word</div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={copyToClipboard} className="transition-transform duration-150 hover:translate-x-0.5">
          <Copy className="w-4 h-4 text-muted-foreground" />
          <span className="text-[13px]">Copy to clipboard</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
