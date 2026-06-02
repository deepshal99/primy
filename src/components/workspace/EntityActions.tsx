"use client";

import { useState } from "react";
import { Download, FileDown, FileType, Share2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { ShareModal } from "@/components/settings/ShareModal";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

// ═══ EntityShareButton — per-file share for the OPEN entity ═══
// Restores the file-level share that the removed TabBar provided. The top-bar
// Share is project-scoped; this shares the specific doc/sheet/deck/page.
export function EntityShareButton() {
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const currentEntityId = useAppStore((s) => s.currentEntityId);
  const currentEntityType = useAppStore((s) => s.currentEntityType);
  const projects = useAppStore((s) => s.projects);
  const [open, setOpen] = useState(false);

  if (!currentEntityId || !currentEntityType || !currentProjectId) return null;
  const project = projects.find((p) => p.id === currentProjectId);
  if (!project) return null;

  let title = "Untitled";
  let token: string | null = null;
  if (currentEntityType === "ku") {
    const e = project.knowledgeUnits.find((k) => k.id === currentEntityId);
    title = e?.title ?? title; token = e?.shareToken ?? null;
  } else if (currentEntityType === "table") {
    const e = project.tables.find((t) => t.id === currentEntityId);
    title = e?.title ?? title; token = e?.shareToken ?? null;
  } else if (currentEntityType === "deck") {
    const e = (project.decks || []).find((d) => d.id === currentEntityId);
    title = e?.title ?? title; token = e?.shareToken ?? null;
  } else if (currentEntityType === "page") {
    const e = (project.pages || []).find((p) => p.id === currentEntityId);
    title = e?.title ?? title; token = e?.shareToken ?? null;
  }

  const applyToken = (newToken: string | null) => {
    const state = useAppStore.getState();
    useAppStore.setState({
      projects: state.projects.map((p) => {
        if (p.id !== currentProjectId) return p;
        const u = { ...p };
        if (currentEntityType === "ku") u.knowledgeUnits = p.knowledgeUnits.map((k) => (k.id === currentEntityId ? { ...k, shareToken: newToken } : k));
        else if (currentEntityType === "table") u.tables = p.tables.map((t) => (t.id === currentEntityId ? { ...t, shareToken: newToken } : t));
        else if (currentEntityType === "deck") u.decks = (p.decks || []).map((d) => (d.id === currentEntityId ? { ...d, shareToken: newToken } : d));
        else if (currentEntityType === "page") u.pages = (p.pages || []).map((pg) => (pg.id === currentEntityId ? { ...pg, shareToken: newToken } : pg));
        return u;
      }),
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-[36px] h-[36px] flex items-center justify-center rounded-lg text-icon hover:text-foreground hover:bg-accent active:scale-[0.95] t-fast cursor-pointer"
        aria-label="Share this file"
        title="Share this file"
      >
        <Share2 className="w-4 h-4" />
      </button>
      <ShareModal open={open} onClose={() => setOpen(false)} mode="file" entityId={currentEntityId} entityTitle={title} currentToken={token} onTokenChange={applyToken} />
    </>
  );
}

// ═══ DeckExport (for TabBar) ═══

export function DeckExport() {
  const slides = useAppStore((s) => s.deckSlides);
  const theme = useAppStore((s) => s.deckTheme);

  const handleExport = async (format: "pdf" | "pptx") => {
    const { exportDeckToPDF, exportDeckToPPTX } = await import("@/components/deck/deckExport");
    if (format === "pdf") exportDeckToPDF(slides, theme);
    else exportDeckToPPTX(slides, theme);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-[36px] h-[36px] flex items-center justify-center rounded-lg text-icon hover:text-foreground hover:bg-accent active:scale-[0.95] t-fast cursor-pointer" aria-label="Export presentation">
          <Download className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => handleExport("pdf")}>
          <FileDown className="w-4 h-4 text-red-500" />
          <span className="text-[13px]">Export PDF</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pptx")}>
          <FileType className="w-4 h-4 text-blue-500" />
          <span className="text-[13px]">Export PPTX</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

