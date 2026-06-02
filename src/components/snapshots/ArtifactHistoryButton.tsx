"use client";

import { useState, useCallback } from "react";
import { History } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import type { ArtifactType } from "./VersionHistoryPanel";

/**
 * Toolbar button that opens the version-history panel for the
 * currently-active artifact. Reads the right slice of state for
 * the "Save version now" action and applies restored content back
 * to the editor on success.
 *
 * Returns null when there is no active artifact — the WorkspacePanel
 * mounts this in the toolbar row, which only renders when an entity
 * is open anyway, but the guard prevents a stray button on Home.
 */
export function ArtifactHistoryButton() {
  const currentEntityId = useAppStore((s) => s.currentEntityId);
  const currentEntityType = useAppStore((s) => s.currentEntityType);
  const sheets = useAppStore((s) => s.sheets);
  const docContent = useAppStore((s) => s.docContent);
  const deckSlides = useAppStore((s) => s.deckSlides);
  const deckTheme = useAppStore((s) => s.deckTheme);

  const updateSheetData = useAppStore((s) => s.updateSheetData);
  const updateDocContent = useAppStore((s) => s.updateDocContent);
  const setDeck = useAppStore((s) => (s as any).setDeck);
  const updateDeck = useAppStore((s) => (s as any).updateDeck);

  const [open, setOpen] = useState(false);

  const getCurrentContent = useCallback(() => {
    switch (currentEntityType) {
      case "ku":
        return { docContent };
      case "table":
        return { sheets };
      case "deck":
        return { slides: deckSlides, theme: deckTheme };
      default:
        return null;
    }
  }, [currentEntityType, docContent, sheets, deckSlides, deckTheme]);

  const handleRestored = useCallback(
    (content: unknown) => {
      if (!content || typeof content !== "object") return;
      const c = content as Record<string, any>;
      switch (currentEntityType) {
        case "ku":
          if (typeof c.docContent === "string") updateDocContent(c.docContent);
          break;
        case "table":
          if (Array.isArray(c.sheets)) updateSheetData(c.sheets);
          break;
        case "deck":
          // Best-effort deck restore — call whichever updater exists.
          // The store schema for decks varies between deckPhase modes;
          // we set slides + theme directly via the most common updater.
          if (typeof updateDeck === "function") {
            updateDeck({ slides: c.slides ?? [], theme: c.theme ?? "light" });
          } else if (typeof setDeck === "function") {
            setDeck({ slides: c.slides ?? [], theme: c.theme ?? "light" });
          }
          break;
      }
    },
    [currentEntityType, updateDocContent, updateSheetData, updateDeck, setDeck]
  );

  if (!currentEntityId || !currentEntityType) return null;

  const type = currentEntityType as ArtifactType;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Version history"
        aria-label="Open version history"
        className="flex items-center justify-center h-8 w-8 rounded-md text-icon hover:bg-accent hover:text-foreground transition-colors"
      >
        <History className="w-4 h-4" />
      </button>
      <VersionHistoryPanel
        open={open}
        onClose={() => setOpen(false)}
        type={type}
        id={currentEntityId}
        getCurrentContent={getCurrentContent}
        onRestored={handleRestored}
      />
    </>
  );
}
