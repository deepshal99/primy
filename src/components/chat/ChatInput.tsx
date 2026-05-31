"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { ArrowUp, Plus, Upload, Square, X } from "lucide-react";
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

// Sourced from the canonical ENTITY_META so colors never drift from the rest
// of the app (these used to hardcode doc=#4a7aed while the breadcrumb used #2a6dfb).
const ENTITY_STYLES: Record<EntityType, { text: string; bg: string; dot: string }> = {
  ku: { text: ENTITY_META.ku.color, bg: ENTITY_META.ku.bg, dot: ENTITY_META.ku.color },
  table: { text: ENTITY_META.table.color, bg: ENTITY_META.table.bg, dot: ENTITY_META.table.color },
  deck: { text: ENTITY_META.deck.color, bg: ENTITY_META.deck.bg, dot: ENTITY_META.deck.color },
  page: { text: ENTITY_META.page.color, bg: ENTITY_META.page.bg, dot: ENTITY_META.page.color },
};

const ENTITY_LABELS: Record<EntityType, string> = {
  ku: ENTITY_META.ku.label,
  table: ENTITY_META.table.label,
  deck: ENTITY_META.deck.label,
  page: ENTITY_META.page.label,
};

interface MentionEntity {
  id: string;
  type: EntityType;
  title: string;
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

  // Listen for global focus-chat event (Cmd+/)
  useEffect(() => {
    const handler = () => textareaRef.current?.focus();
    window.addEventListener("drafta:focus-chat", handler);
    return () => window.removeEventListener("drafta:focus-chat", handler);
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
        }
      }, 0);
    },
    [value]
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
        }
      });
    },
    [value, mentionStart, dismissMention]
  );

  const removeMention = useCallback((id: string) => {
    setMentionedEntities((prev) => prev.filter((e) => e.id !== id));
  }, []);

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
      toast.error("Message truncated — maximum 50,000 characters");
    }
    const cursorPos = e.target.selectionStart;
    setValue(newValue);

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

    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
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
          "relative t-normal",
          !pill && "rounded-[20px] border border-[#e8e8ed] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)]",
          !pill && isDragOver && "border-[#FFB43F] shadow-[0_0_0_2px_rgba(255,180,63,0.12)]",
          !pill && !isDragOver && !disabled && "focus-within:border-[#FFB43F]/40 focus-within:shadow-[0_2px_8px_rgba(0,0,0,0.04)]",
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
            <div className="flex items-center gap-2 text-[#B87426]">
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
            className="absolute bottom-full left-4 right-4 mb-1.5 z-20 bg-card rounded-xl border border-[#e8e7e4] shadow-[0_8px_30px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden animate-fade-in"
          >
            <div className="max-h-[240px] overflow-y-auto py-1">
              {filteredEntities.map((entity, i) => (
                <button
                  key={entity.id}
                  role="option"
                  aria-selected={i === mentionIndex}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3.5 py-2 text-left transition-colors cursor-pointer",
                    i === mentionIndex ? "bg-[#f5f4f1]" : "hover:bg-[#fafaf8]"
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent textarea blur
                    selectMention(entity);
                  }}
                  onMouseEnter={() => setMentionIndex(i)}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: ENTITY_STYLES[entity.type].dot }}
                  />
                  <span className="text-[13px] text-foreground truncate flex-1">{entity.title}</span>
                  <span className="text-[11px] text-[#95928E] shrink-0">{ENTITY_LABELS[entity.type]}</span>
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

        {/* Mentioned entity pills */}
        {mentionedEntities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-3 pb-0">
            {mentionedEntities.map((entity) => {
              const style = ENTITY_STYLES[entity.type];
              return (
                <span
                  key={entity.id}
                  className="inline-flex items-center gap-1.5 h-6 pl-2 pr-1 rounded-full text-[11px] font-medium"
                  style={{ backgroundColor: style.bg, color: style.text }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: style.dot }}
                  />
                  {entity.title}
                  <button
                    onClick={() => removeMention(entity.id)}
                    aria-label={`Remove ${entity.title}`}
                    className="w-4 h-4 rounded-full flex items-center justify-center hover:opacity-60 transition-opacity cursor-pointer"
                    style={{ color: style.text }}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholderProp || (pill ? "Ask anything..." : "Ask anything... (type @ to mention)")}
          rows={1}
          aria-label="Chat message"
          className={cn(
            "w-full bg-transparent resize-none outline-none text-foreground tracking-[-0.01em] placeholder:text-[#a3a3a3]",
            pill ? "pl-[46px] pr-[46px] py-[14px] text-[14px] leading-[1.4]" : "px-5 pt-4 pb-14 text-[14px]"
          )}
          style={pill ? { minHeight: 24, maxHeight: 140 } : { minHeight: 100, maxHeight: 180 }}
        />

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

        {/* Plus button -- bottom left */}
        <button
          onClick={handleFileClick}
          disabled={disabled}
          className={cn(
            "absolute flex items-center justify-center active:scale-[0.95] t-fast disabled:opacity-40 cursor-pointer",
            pill
              ? "left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full text-[#6E6E73] hover:text-[#1a1a1a] hover:bg-[rgba(24,24,22,0.05)]"
              : "bottom-3 left-3.5 w-8 h-8 rounded-full border border-[#e8e8ed] bg-white text-[#737373] hover:text-[#1a1a1a] hover:border-[#dddfe3] hover:bg-[#f5f5f3]"
          )}
          title="Attach files"
          aria-label="Attach files"
        >
          <Plus className="w-[18px] h-[18px]" strokeWidth={1.9} />
        </button>

        {/* Send / Stop button -- bottom right */}
        {disabled && onStop ? (
          <button
            onClick={onStop}
            className={cn(
              "absolute rounded-full bg-[#1A1815] text-white flex items-center justify-center hover:bg-black active:scale-[0.95] t-fast cursor-pointer",
              pill ? "right-2 top-1/2 -translate-y-1/2 w-9 h-9" : "bottom-3 right-3.5 w-8 h-8"
            )}
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
              "absolute rounded-full flex items-center justify-center t-fast",
              pill ? "right-2 top-1/2 -translate-y-1/2 w-9 h-9" : "bottom-3 right-3.5 w-8 h-8",
              canSend
                ? "bg-[#1A1815] text-white cursor-pointer hover:bg-black active:scale-[0.95] shadow-[0_2px_6px_rgba(24,24,22,0.20)]"
                : "bg-[rgba(24,24,22,0.06)] text-[#a3a3a3] cursor-not-allowed"
            )}
          >
            <ArrowUp className="w-[17px] h-[17px]" strokeWidth={2.4} />
          </button>
        )}
      </div>
    </div>
  );
}
