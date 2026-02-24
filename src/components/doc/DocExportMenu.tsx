"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Download, FileText, Copy, ChevronDown, FileDown } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";

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
    const { default: jsPDF } = await import("jspdf");

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    const lines = docContent.split("\n");

    for (const line of lines) {
      // Check if we need a new page
      if (y > 270) {
        doc.addPage();
        y = margin;
      }

      if (line.startsWith("# ")) {
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        const text = line.replace(/^# /, "");
        const wrapped = doc.splitTextToSize(text, maxWidth);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 8 + 4;
      } else if (line.startsWith("## ")) {
        doc.setFontSize(17);
        doc.setFont("helvetica", "bold");
        const text = line.replace(/^## /, "");
        const wrapped = doc.splitTextToSize(text, maxWidth);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 7 + 3;
      } else if (line.startsWith("### ")) {
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        const text = line.replace(/^### /, "");
        const wrapped = doc.splitTextToSize(text, maxWidth);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 6 + 2;
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        const text = line.replace(/^[-*] /, "");
        const wrapped = doc.splitTextToSize(text, maxWidth - 8);
        doc.text("\u2022", margin, y);
        doc.text(wrapped, margin + 6, y);
        y += wrapped.length * 5 + 1;
      } else if (/^\d+\. /.test(line)) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        const match = line.match(/^(\d+)\. (.*)/);
        if (match) {
          const wrapped = doc.splitTextToSize(match[2], maxWidth - 10);
          doc.text(`${match[1]}.`, margin, y);
          doc.text(wrapped, margin + 8, y);
          y += wrapped.length * 5 + 1;
        }
      } else if (line.trim() === "") {
        y += 3;
      } else if (line.startsWith("> ")) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "italic");
        const text = line.replace(/^> /, "");
        const wrapped = doc.splitTextToSize(text, maxWidth - 10);
        doc.setDrawColor(200);
        doc.setLineWidth(0.5);
        doc.line(margin + 2, y - 3, margin + 2, y + wrapped.length * 5);
        doc.text(wrapped, margin + 6, y);
        y += wrapped.length * 5 + 2;
      } else if (line === "---") {
        doc.setDrawColor(200);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageWidth - margin, y);
        y += 4;
      } else {
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        // Strip bold/italic markdown for PDF
        const cleanText = line
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/\*(.*?)\*/g, "$1")
          .replace(/`(.*?)`/g, "$1");
        const wrapped = doc.splitTextToSize(cleanText, maxWidth);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 5 + 1;
      }
    }

    doc.save("document.pdf");
    setOpen(false);
    toast.success("Downloaded PDF");
  }, [docContent]);

  const downloadMarkdown = useCallback(() => {
    const blob = new Blob([docContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "document.md";
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
