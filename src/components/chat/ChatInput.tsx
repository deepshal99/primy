"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowUp, Plus, Loader2, Upload, Square } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { FileAttachment } from "@/lib/types";
import {
  isAcceptedFile,
  MAX_FILE_SIZE,
  MAX_FILES_PER_MESSAGE,
  createAttachmentFromFile,
  processFile,
  getAcceptString,
} from "@/lib/fileUtils";
import { design } from "@/lib/design";
import { FilePreviewPill } from "./FilePreviewPill";

interface ChatInputProps {
  onSend: (message: string, attachments?: FileAttachment[]) => void;
  disabled: boolean;
  centered?: boolean;
  onStop?: () => void;
}

export function ChatInput({ onSend, disabled, centered, onStop }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

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

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && pendingAttachments.length === 0) || disabled) return;
    if (pendingAttachments.some((a) => a.isExtracting)) {
      toast.error("Wait for files to finish processing");
      return;
    }
    onSend(trimmed, pendingAttachments.length > 0 ? [...pendingAttachments] : undefined);
    setValue("");
    clearPendingAttachments();
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, onSend, pendingAttachments, clearPendingAttachments]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 150) + "px";
  };

  // ── File handling ──

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      let added = 0;

      for (const file of fileArray) {
        // Use live state to get accurate count (avoids stale closure)
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

  // ── Paste images/media ──

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            // Give pasted images a descriptive name
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

  // ── Drag & Drop ──

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

  return (
    <div className={`px-4 pb-5 pt-2 ${centered ? "px-6" : ""}`}>
      <div
        className={`relative rounded-2xl border transition-all duration-200 ${
          isDragOver
            ? "shadow-[0_0_0_3px_rgba(107,143,163,0.1)]"
            : disabled
            ? "opacity-60"
            : "focus-within:shadow-sm"
        }`}
        style={{
          backgroundColor: design.colors.bg.input,
          borderColor: isDragOver
            ? design.colors.brand.primary
            : design.colors.border.default,
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragOver && (
          <div
            className="absolute inset-0 rounded-2xl flex items-center justify-center z-10 border-2 border-dashed pointer-events-none"
            style={{
              backgroundColor: design.colors.brand.subtle,
              borderColor: design.colors.brand.primary,
            }}
          >
            <div className="flex items-center gap-2" style={{ color: design.colors.brand.primary }}>
              <Upload className="w-4 h-4" />
              <span className="text-ui">Drop files here</span>
            </div>
          </div>
        )}

        {/* Pending file previews */}
        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3.5 pt-3 pb-1">
            {pendingAttachments.map((att) => (
              <FilePreviewPill
                key={att.id}
                attachment={att}
                onRemove={removePendingAttachment}
              />
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-2 px-3.5 py-2.5">
          {/* File attach button */}
          <button
            onClick={handleFileClick}
            disabled={disabled}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full border transition-colors duration-150 disabled:opacity-40"
            style={{
              borderColor: design.colors.border.default,
              color: design.colors.text.muted,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = design.colors.text.secondary;
              e.currentTarget.style.backgroundColor = design.colors.bg.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = design.colors.text.muted;
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            title="Attach files"
          >
            <Plus className="w-3.5 h-3.5 icon-plus-hover" strokeWidth={2} />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={getAcceptString()}
            onChange={handleFileChange}
            className="hidden"
          />

          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              disabled
                ? "Waiting for response..."
                : "Describe what you need..."
            }
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent text-body resize-none outline-none max-h-[150px] py-0.5"
            style={{
              color: design.colors.text.primary,
            }}
          />

          {disabled && onStop ? (
            <button
              onClick={onStop}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200"
              style={{
                backgroundColor: "#e54545",
                color: "#fff",
                cursor: "pointer",
              }}
              title="Stop generating"
            >
              <Square className="w-3.5 h-3.5" fill="currentColor" strokeWidth={0} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canSend}
              className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 icon-send-press"
              style={{
                backgroundColor: canSend
                  ? design.colors.brand.primary
                  : design.colors.border.default,
                color: canSend
                  ? design.colors.brand.text
                  : design.colors.text.muted,
                cursor: canSend ? "pointer" : "not-allowed",
              }}
            >
              <ArrowUp className="w-4 h-4 icon-float-up" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
