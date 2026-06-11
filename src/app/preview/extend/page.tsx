"use client";

import * as React from "react";
import {
  PDFViewer,
  type PDFViewerHandle,
  type PDFViewerPageOverlayProps,
} from "@/components/ui/pdf-viewer";

type Citation = {
  id: string;
  label: string;
  quote: string;
  page: number;
  // PDF points (origin top-left), matches the sample 612x792 page
  box: { top: number; left: number; width: number; height: number };
};

const CITATIONS: Citation[] = [
  {
    id: "c1",
    label: "Heading",
    quote: "Sample PDF title block",
    page: 1,
    box: { top: 70, left: 60, width: 300, height: 40 },
  },
  {
    id: "c2",
    label: "Body paragraph",
    quote: "First paragraph of body copy",
    page: 1,
    box: { top: 140, left: 60, width: 480, height: 90 },
  },
  {
    id: "c3",
    label: "Footer region",
    quote: "Bottom-of-page content",
    page: 1,
    box: { top: 660, left: 60, width: 480, height: 60 },
  },
];

export default function ExtendPreviewPage() {
  const viewerRef = React.useRef<PDFViewerHandle>(null);
  const [activeCitation, setActiveCitation] = React.useState<string | null>(
    null
  );

  const jumpTo = (citation: Citation) => {
    setActiveCitation(citation.id);
    viewerRef.current?.scrollToPageArea(citation.page, citation.box, {
      behavior: "smooth",
    });
  };

  const renderPageOverlay = ({
    pageNumber,
    scale,
  }: PDFViewerPageOverlayProps) => {
    const active = CITATIONS.find(
      (c) => c.id === activeCitation && c.page === pageNumber
    );
    if (!active) return null;
    return (
      <div
        className="pointer-events-none absolute rounded-[4px]"
        style={{
          top: active.box.top * scale,
          left: active.box.left * scale,
          width: active.box.width * scale,
          height: active.box.height * scale,
          background: "rgba(255, 180, 63, 0.22)",
          boxShadow: "0 0 0 1.5px rgba(184, 116, 38, 0.55)",
        }}
      />
    );
  };

  return (
    <div className="flex h-screen flex-col bg-[var(--canvas,#F3F2EF)]">
      <header className="flex items-center justify-between border-b border-[rgba(24,24,22,0.08)] bg-[#FCFBF8] px-5 py-3">
        <div>
          <h1 className="text-[15px] font-medium text-[#171716]">
            Extend UI spike: PDF viewer + citations
          </h1>
          <p className="text-[12.5px] text-[#706E68]">
            Source-file viewing for uploads, with click-to-source highlights.
            Drop your own PDF via the toolbar upload button.
          </p>
        </div>
        <span className="rounded-full bg-[rgba(255,180,63,0.18)] px-2.5 py-1 text-[11.5px] font-medium text-[#B87426]">
          Preview only
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-[260px] shrink-0 border-r border-[rgba(24,24,22,0.08)] bg-[#F7F7F4] p-4">
          <h2 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-[#706E68]">
            Citations demo
          </h2>
          <p className="mb-3 text-[12.5px] leading-relaxed text-[#706E68]">
            Simulated AI answers grounded in the document. Click one to jump
            and highlight the source region.
          </p>
          <div className="space-y-2">
            {CITATIONS.map((c) => (
              <button
                key={c.id}
                onClick={() => jumpTo(c)}
                className={`w-full rounded-[8px] border px-3 py-2.5 text-left transition-colors ${
                  activeCitation === c.id
                    ? "border-[rgba(184,116,38,0.45)] bg-[rgba(255,180,63,0.14)]"
                    : "border-[rgba(24,24,22,0.08)] bg-[#FFFDFB] hover:bg-[#FCFBF8]"
                }`}
              >
                <span className="block text-[13px] font-medium text-[#171716]">
                  {c.label}
                </span>
                <span className="block text-[12px] text-[#706E68]">
                  &ldquo;{c.quote}&rdquo; (p. {c.page})
                </span>
              </button>
            ))}
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <PDFViewer
            ref={viewerRef}
            file="/preview/sample.pdf"
            defaultZoom={1}
            showUpload
            showDownload
            downloadFileName="sample.pdf"
            renderPageOverlay={renderPageOverlay}
            className="h-full"
          />
        </main>
      </div>
    </div>
  );
}
