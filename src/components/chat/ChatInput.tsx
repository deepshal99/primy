"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { ArrowUp, Plus, Upload, Square } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { FileAttachment, EntityType } from "@/lib/types";
import {
  isAcceptedFile,
  MAX_FILE_SIZE,
  MAX_FILES_PER_MESSAGE,
  createAttachmentFromFile,
  processFile,
  getAcceptString,
} from "@/lib/fileUtils";
import { cn } from "@/lib/cn";
import { FilePreviewPill } from "./FilePreviewPill";
import { SlashCommandMenu } from "./SlashCommandMenu";
import { SLASH_COMMANDS, type SlashCommand } from "@/lib/ai/slashCommands";
import { usePlanInfo } from "@/hooks/usePlanInfo";
import { ENTITY_META } from "@/lib/entityMeta";

const MAX_INPUT_LENGTH = 50_000; // 50K chars — prevents enormous pastes from blowing up context

// Short type tags shown on the right of each mention suggestion. The full
// ENTITY_META labels ("Spreadsheet", "Presentation") are too long for the
// narrow dropdown and clip; these stay readable at a glance.
const ENTITY_SHORT: Record<EntityType, string> = {
  ku: "Doc",
  table: "Sheet",
  deck: "Deck",
  page: "Page",
};

interface MentionEntity {
  id: string;
  type: EntityType;
  title: string;
}

/**
 * Splits the raw input text into plain runs and highlighted @mention chips
 * for the mirror overlay. Font metrics MUST stay identical to the textarea
 * (same weight / size / spacing) — the chip is background-only (no padding,
 * radius faked via a same-color box-shadow spread) so it never shifts the
 * caret or wrapping.
 */
function renderMentionSegments(
  text: string,
  entities: MentionEntity[]
): React.ReactNode[] {
  if (entities.length === 0) return [text];
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    let earliest = Infinity;
    let matched: MentionEntity | null = null;
    let pattern = "";
    for (const e of entities) {
      const p = `@${e.title}`;
      const i = remaining.indexOf(p);
      if (i === -1) continue;
      // At the same position, prefer the LONGER title so "@Report Q3" isn't
      // mis-chipped as "@Report" + " Q3".
      if (i < earliest || (i === earliest && p.length > pattern.length)) {
        earliest = i;
        matched = e;
        pattern = p;
      }
    }
    if (!matched || earliest === Infinity) {
      nodes.push(remaining);
      break;
    }
    if (earliest > 0) nodes.push(remaining.slice(0, earliest));
    const meta = ENTITY_META[matched.type];
    nodes.push(
      <span
        key={key++}
        style={{
          backgroundColor: meta.bg,
          color: "var(--ink)",
          borderRadius: 4,
          // Flat highlight that hugs the glyph box exactly — no box-shadow/padding
          // that would (a) get clipped by the overlay's overflow-hidden at line
          // edges or (b) desync the transparent textarea's caret. `clone` makes a
          // mention that wraps render as a clean chip on each line instead of one
          // broken box.
          WebkitBoxDecorationBreak: "clone",
          boxDecorationBreak: "clone",
        }}
      >
        {pattern}
      </span>
    );
    remaining = remaining.slice(earliest + pattern.length);
  }
  return nodes;
}

interface ChatInputProps {
  onSend: (message: string, attachments?: FileAttachment[], mentionedEntities?: MentionEntity[]) => void;
  disabled: boolean;
  centered?: boolean;
  onStop?: () => void;
  placeholder?: string;
  /** Compact single-line pill style (branded V2 docked chat). */
  pill?: boolean;
}

export function ChatInput({ onSend, disabled, centered, onStop, placeholder: placeholderProp, pill }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(0);
  const [mentionedEntities, setMentionedEntities] = useState<MentionEntity[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  // Slash command popover state. Active only when value starts with `/`
  // and the cursor is inside the leading slash word (no whitespace yet).
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const mentionListRef = useRef<HTMLDivElement>(null);
  // Mirror layer that paints @mentions as chips behind the (transparent)
  // textarea. Kept scroll-synced so the highlight tracks the caret 1:1.
  const overlayRef = useRef<HTMLDivElement>(null);

  const syncOverlayScroll = useCallback(() => {
    const el = overlayRef.current;
    if (el) el.style.transform = `translateY(${-(textareaRef.current?.scrollTop ?? 0)}px)`;
  }, []);

  // Recompute the textarea height from its content. Must be called after any
  // PROGRAMMATIC value change (mention / slash insert) too — those bypass the
  // onChange resize, so a multi-line insert would otherwise stay clipped.
  const autoSizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // Cap matches the variant's maxHeight so the box stops growing exactly where
    // the scrollbar takes over — pill docks compactly, the hero gets more room.
    el.style.height = Math.min(el.scrollHeight, pill ? 140 : 180) + "px";
    syncOverlayScroll();
  }, [pill, syncOverlayScroll]);

  // Listen for global focus-chat event (Cmd+/)
  useEffect(() => {
    const handler = () => textareaRef.current?.focus();
    window.addEventListener("primy:focus-chat", handler);
    return () => window.removeEventListener("primy:focus-chat", handler);
  }, []);

  const pendingAttachments = useAppStore((s) => s.pendingAttachments);
  const addPendingAttachment = useAppStore((s) => s.addPendingAttachment);
  const removePendingAttachment = useAppStore((s) => s.removePendingAttachment);
  const updatePendingAttachment = useAppStore((s) => s.updatePendingAttachment);
  const clearPendingAttachments = useAppStore((s) => s.clearPendingAttachments);

  // Get all entities from the current project
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const projects = useAppStore((s) => s.projects);
  const allEntities = useMemo(() => {
    const project = projects.find((p) => p.id === currentProjectId);
    if (!project) return [] as MentionEntity[];
    const entities: MentionEntity[] = [];
    for (const ku of project.knowledgeUnits) {
      entities.push({ id: ku.id, type: "ku", title: ku.title });
    }
    for (const t of project.tables) {
      entities.push({ id: t.id, type: "table", title: t.title });
    }
    for (const dk of project.decks || []) {
      entities.push({ id: dk.id, type: "deck", title: dk.title });
    }
    return entities;
  }, [projects, currentProjectId]);

  // Filter entities by mention query
  const filteredEntities = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    const already = new Set(mentionedEntities.map((e) => e.id));
    return allEntities
      .filter((e) => !already.has(e.id) && e.title.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionQuery, allEntities, mentionedEntities]);

  // Reset mention index when filtered list changes
  const filteredCount = filteredEntities.length;
  useEffect(() => {
    setMentionIndex(0);
  }, [filteredCount]);

  const dismissMention = useCallback(() => {
    setMentionQuery(null);
    setMentionStart(0);
    setMentionIndex(0);
  }, []);

  // ── Slash command state derivation ────────────────────────────
  const planInfo = usePlanInfo();
  const effectivePlan = planInfo.loading ? "free" : planInfo.plan;

  const filteredSlashCommands = useMemo(() => {
    if (slashQuery === null) return [] as SlashCommand[];
    const q = slashQuery.toLowerCase();
    if (!q) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(
      (c) => c.name.toLowerCase().startsWith(q) || c.label.toLowerCase().includes(q)
    );
  }, [slashQuery]);

  // Reset highlighted slash command when filter changes.
  const slashCount = filteredSlashCommands.length;
  useEffect(() => {
    setSlashIndex(0);
  }, [slashCount]);

  const selectSlashCommand = useCallback(
    (cmd: SlashCommand) => {
      // Replace the leading "/word" with "/<name> " — user continues typing context.
      const trailing = value.replace(/^\/\S*/, "").trimStart();
      const next = `/${cmd.name} ${trailing}`;
      setValue(next);
      setSlashQuery(null);
      setSlashIndex(0);
      // Restore caret to end-of-input on next tick.
      setTimeout(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          ta.setSelectionRange(next.length, next.length);
          autoSizeTextarea();
        }
      }, 0);
    },
    [value, autoSizeTextarea]
  );

  const selectMention = useCallback(
    (entity: MentionEntity) => {
      // Replace @query in textarea with @Title
      const before = value.slice(0, mentionStart);
      const after = value.slice(textareaRef.current?.selectionStart ?? value.length);
      // Find end of mention query text after @
      const afterAt = value.slice(mentionStart);
      const spaceIdx = afterAt.search(/\s/);
      const restAfterQuery = spaceIdx >= 0 ? afterAt.slice(spaceIdx) : "";
      const newValue = `${before}@${entity.title} ${restAfterQuery}`;
      setValue(newValue);
      setMentionedEntities((prev) => [...prev, entity]);
      dismissMention();
      // Focus and set cursor position after inserted mention
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          const cursorPos = before.length + entity.title.length + 2; // +2 for @ and space
          ta.focus();
          ta.setSelectionRange(cursorPos, cursorPos);
          autoSizeTextarea();
        }
      });
    },
    [value, mentionStart, dismissMention, autoSizeTextarea]
  );

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && pendingAttachments.length === 0) || disabled) return;
    if (pendingAttachments.some((a) => a.isExtracting)) {
      toast.error("Wait for files to finish processing");
      return;
    }
    onSend(
      trimmed,
      pendingAttachments.length > 0 ? [...pendingAttachments] : undefined,
      mentionedEntities.length > 0 ? [...mentionedEntities] : undefined
    );
    setValue("");
    setMentionedEntities([]);
    clearPendingAttachments();
    dismissMention();
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, onSend, pendingAttachments, clearPendingAttachments, mentionedEntities, dismissMention]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // When mention popover is open, handle navigation
    if (mentionQuery !== null && filteredEntities.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % filteredEntities.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + filteredEntities.length) % filteredEntities.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        selectMention(filteredEntities[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        dismissMention();
        return;
      }
    }

    // Slash command popover navigation (only when actively shown).
    if (slashQuery !== null) {
      const list = filteredSlashCommands;
      if (list.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSlashIndex((prev) => (prev + 1) % list.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSlashIndex((prev) => (prev - 1 + list.length) % list.length);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          selectSlashCommand(list[slashIndex]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setSlashQuery(null);
          return;
        }
        // Tab also accepts top suggestion — convenient autocomplete
        if (e.key === "Tab") {
          e.preventDefault();
          selectSlashCommand(list[slashIndex]);
          return;
        }
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let newValue = e.target.value;
    if (newValue.length > MAX_INPUT_LENGTH) {
      newValue = newValue.slice(0, MAX_INPUT_LENGTH);
      toast.error("Message truncated to a maximum of 50,000 characters");
    }
    const cursorPos = e.target.selectionStart;
    setValue(newValue);

    // Keep tracked mentions in sync with the text. If the user deletes an
    // "@Title" from the textarea, drop it — otherwise the entity stays
    // attached invisibly and is sent even though it's no longer written.
    setMentionedEntities((prev) => prev.filter((ent) => newValue.includes(`@${ent.title}`)));

    // Detect @ mention
    if (cursorPos > 0) {
      // Scan backwards from cursor to find @
      const textBeforeCursor = newValue.slice(0, cursorPos);
      const lastAt = textBeforeCursor.lastIndexOf("@");
      if (lastAt >= 0) {
        // Check that @ is at start of input or preceded by whitespace
        const charBefore = lastAt > 0 ? textBeforeCursor[lastAt - 1] : " ";
        if (charBefore === " " || charBefore === "\n" || lastAt === 0) {
          const query = textBeforeCursor.slice(lastAt + 1);
          // Only activate if no space in query (single word matching)
          if (!query.includes("\n")) {
            setMentionQuery(query);
            setMentionStart(lastAt);
          } else {
            dismissMention();
          }
        } else {
          dismissMention();
        }
      } else {
        dismissMention();
      }
    } else {
      dismissMention();
    }

    // Detect leading slash command — only at position 0, before whitespace.
    // `/proposal` shows menu; `/proposal Acme` (after space) hides it.
    if (newValue.startsWith("/")) {
      const firstSpace = newValue.search(/\s/);
      const slashWord = firstSpace === -1 ? newValue.slice(1) : null;
      if (slashWord !== null && cursorPos <= newValue.length) {
        setSlashQuery(slashWord);
      } else {
        setSlashQuery(null);
      }
    } else {
      setSlashQuery(null);
    }

    autoSizeTextarea();
  };

  // -- File handling --

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      for (const file of fileArray) {
        const liveCount = useAppStore.getState().pendingAttachments.length;
        if (liveCount >= MAX_FILES_PER_MESSAGE) {
          toast.error(`Maximum ${MAX_FILES_PER_MESSAGE} files per message`);
          break;
        }
        if (!isAcceptedFile(file)) {
          toast.error(`Unsupported file type: ${file.name}`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`File too large: ${file.name} (max 100MB)`);
          continue;
        }

        const attachment = createAttachmentFromFile(file);
        addPendingAttachment(attachment);

        try {
          const updates = await processFile(file, attachment);
          updatePendingAttachment(attachment.id, updates);
        } catch (err) {
          if (process.env.NODE_ENV !== "production") console.error("File processing error:", err);
          toast.error(`Failed to process: ${file.name}`);
          removePendingAttachment(attachment.id);
        }
      }
    },
    [pendingAttachments, addPendingAttachment, updatePendingAttachment, removePendingAttachment]
  );

  const handleFileClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
      e.target.value = "";
    }
  };

  // -- Paste images/media --

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            const mimeType = file.type || "image/png";
            const ext = mimeType.split("/")[1] || "png";
            const named = new File([file], `Pasted image ${new Date().toLocaleTimeString()}.${ext}`, { type: mimeType });
            imageFiles.push(named);
          }
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        handleFiles(imageFiles);
      }
    },
    [handleFiles]
  );

  // -- Drag & Drop --

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const canSend =
    (value.trim().length > 0 || pendingAttachments.length > 0) &&
    !disabled &&
    !pendingAttachments.some((a) => a.isExtracting);

  const showMentionPopover = mentionQuery !== null && filteredEntities.length > 0;

  return (
    <div className={cn("px-3 pb-4 pt-2", centered && "px-0", pill && "px-4 pb-4 pt-1")}>
      <div
        className={cn(
          "relative t-normal flex flex-col",
          !pill && "rounded-[20px] border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.02)]",
          !pill && isDragOver && "border-[#FFB43F] shadow-[0_0_0_2px_rgba(255,180,63,0.12)]",
          !pill && !isDragOver && !disabled && "focus-within:border-[var(--accent-amber)]/40 focus-within:shadow-[var(--shadow-card)]",
          pill && "rounded-[24px] bg-[var(--input-background,#F0EFEC)]",
          pill && isDragOver && "ring-2 ring-[#FFB43F]/30",
          pill && !isDragOver && !disabled && "focus-within:ring-2 focus-within:ring-[rgba(24,24,22,0.06)]"
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragOver && (
          <div className="absolute inset-0 rounded-[20px] flex items-center justify-center z-10 border-2 border-dashed pointer-events-none bg-[rgba(255,180,63,0.10)] border-[#FFB43F]">
            <div className="flex items-center gap-2 text-[var(--accent-amber-deep)]">
              <Upload className="w-4 h-4" />
              <span className="text-[13px] font-medium">Drop files here</span>
            </div>
          </div>
        )}

        {/* Slash command popover */}
        {slashQuery !== null && filteredSlashCommands.length > 0 && (
          <SlashCommandMenu
            query={slashQuery}
            selectedIndex={slashIndex}
            setSelectedIndex={setSlashIndex}
            onSelect={selectSlashCommand}
            effectivePlan={effectivePlan}
          />
        )}

        {/* @ Mention popover */}
        {showMentionPopover && (
          <div
            ref={mentionListRef}
            role="listbox"
            aria-label="Mention suggestions"
            className="absolute bottom-full left-4 right-4 mb-1.5 z-20 bg-card rounded-xl border border-border shadow-[var(--shadow-pane)] overflow-hidden menu-pop"
          >
            <div className="max-h-[240px] overflow-y-auto p-1">
              {filteredEntities.map((entity, i) => (
                <button
                  key={entity.id}
                  role="option"
                  aria-selected={i === mentionIndex}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left t-colors cursor-pointer",
                    i === mentionIndex ? "bg-accent" : "hover:bg-accent"
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent textarea blur
                    selectMention(entity);
                  }}
                  onMouseEnter={() => setMentionIndex(i)}
                >
                  {(() => {
                    const EIcon = ENTITY_META[entity.type].Icon;
                    return <EIcon className="w-4 h-4 text-icon shrink-0" strokeWidth={1.6} aria-hidden />;
                  })()}
                  <span className="text-[13px] text-foreground truncate flex-1">{entity.title}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{ENTITY_SHORT[entity.type]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pending file previews */}
        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3.5 pb-0">
            {pendingAttachments.map((att) => (
              <FilePreviewPill
                key={att.id}
                attachment={att}
                onRemove={removePendingAttachment}
              />
            ))}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={getAcceptString()}
          onChange={handleFileChange}
          className="hidden"
          aria-label="Upload files"
        />

        {/* Attach (+) button — shared across variants, styled per layout. */}
        {pill ? (
          /* Pill: a single flex-end action row. `items-end` keeps the + and
             send pinned to the BOTTOM line as the textarea grows, so they never
             float in the vertical middle and text is never hidden behind them.
             The textarea is a flex child (not absolutely overlaid), so wrapping
             stays consistent on every line — no ragged right edge. */
          <div className="flex items-end gap-1.5 px-2 py-2">
            <button
              onClick={handleFileClick}
              disabled={disabled}
              className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full text-[#6E6E73] hover:text-[#1a1a1a] hover:bg-[rgba(24,24,22,0.06)] active:scale-[0.95] t-fast disabled:opacity-40 cursor-pointer"
              title="Attach files"
              aria-label="Attach files"
            >
              <Plus className="w-[18px] h-[18px]" strokeWidth={1.9} />
            </button>
            <div className="relative flex-1 min-w-0 self-center">
              {/* Mention highlight mirror — sits behind the transparent textarea
                  and paints @mentions as tinted chips while typing. */}
              <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden select-none">
                <div
                  ref={overlayRef}
                  className="text-[14px] leading-[1.45] tracking-[-0.01em] py-[7px] whitespace-pre-wrap break-words text-foreground"
                >
                  {renderMentionSegments(value, mentionedEntities)}
                </div>
              </div>
              <textarea
                ref={textareaRef}
                value={value}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onScroll={syncOverlayScroll}
                placeholder={placeholderProp || "Ask anything..."}
                rows={1}
                aria-label="Chat message"
                className="relative w-full bg-transparent resize-none outline-none text-transparent caret-[var(--ink)] tracking-[-0.01em] placeholder:text-[#a3a3a3] text-[14px] leading-[1.45] py-[7px] chat-scroll"
                style={{ minHeight: 22, maxHeight: 140 }}
              />
            </div>
            {disabled && onStop ? (
              <button
                onClick={onStop}
                className="shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center w-9 h-9 hover:bg-black active:scale-[0.95] t-fast cursor-pointer"
                title="Stop generating"
                aria-label="Stop generating"
              >
                <Square className="w-3 h-3 rounded-[1px]" fill="currentColor" strokeWidth={0} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSend}
                aria-label="Send message"
                className={cn(
                  "shrink-0 rounded-full flex items-center justify-center w-9 h-9 t-fast",
                  canSend
                    ? "bg-primary text-primary-foreground cursor-pointer hover:bg-black active:scale-[0.95] shadow-[0_2px_6px_rgba(24,24,22,0.20)]"
                    : "bg-muted text-[#a3a3a3] cursor-not-allowed"
                )}
              >
                <ArrowUp className="w-[17px] h-[17px]" strokeWidth={2.4} />
              </button>
            )}
          </div>
        ) : (
          /* Hero (non-pill): roomy box, text flows full-width with the action
             controls anchored along the bottom edge. */
          <>
            <div className="relative w-full">
              {/* Mention highlight mirror — see pill variant. */}
              <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden select-none">
                <div
                  ref={overlayRef}
                  className="px-5 pt-4 pb-14 text-[14px] leading-[1.5] tracking-[-0.01em] whitespace-pre-wrap break-words text-foreground"
                >
                  {renderMentionSegments(value, mentionedEntities)}
                </div>
              </div>
              <textarea
                ref={textareaRef}
                value={value}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onScroll={syncOverlayScroll}
                placeholder={placeholderProp || "Ask anything... (type @ to mention)"}
                rows={1}
                aria-label="Chat message"
                className="relative w-full bg-transparent resize-none outline-none text-transparent caret-[var(--ink)] tracking-[-0.01em] placeholder:text-[#a3a3a3] px-5 pt-4 pb-14 text-[14px] leading-[1.5] chat-scroll"
                style={{ minHeight: 100, maxHeight: 180 }}
              />
            </div>
            <button
              onClick={handleFileClick}
              disabled={disabled}
              className="absolute bottom-3 left-3.5 flex items-center justify-center w-8 h-8 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-border hover:bg-accent active:scale-[0.95] t-fast disabled:opacity-40 cursor-pointer"
              title="Attach files"
              aria-label="Attach files"
            >
              <Plus className="w-[18px] h-[18px]" strokeWidth={1.9} />
            </button>
            {disabled && onStop ? (
              <button
                onClick={onStop}
                className="absolute bottom-3 right-3.5 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-black active:scale-[0.95] t-fast cursor-pointer"
                title="Stop generating"
                aria-label="Stop generating"
              >
                <Square className="w-3 h-3 rounded-[1px]" fill="currentColor" strokeWidth={0} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSend}
                aria-label="Send message"
                className={cn(
                  "absolute bottom-3 right-3.5 w-8 h-8 rounded-full flex items-center justify-center t-fast",
                  canSend
                    ? "bg-primary text-primary-foreground cursor-pointer hover:bg-black active:scale-[0.95] shadow-[0_2px_6px_rgba(24,24,22,0.20)]"
                    : "bg-muted text-[#a3a3a3] cursor-not-allowed"
                )}
              >
                <ArrowUp className="w-[17px] h-[17px]" strokeWidth={2.4} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
