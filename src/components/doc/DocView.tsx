"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Plate, PlateContent, usePlateEditor } from "platejs/react";
import {
  BasicBlocksPlugin,
  BasicMarksPlugin,
  HighlightPlugin,
} from "@platejs/basic-nodes/react";
import { CodeBlockPlugin } from "@platejs/code-block/react";
import { ListPlugin } from "@platejs/list-classic/react";
import { LinkPlugin } from "@platejs/link/react";
import { TextAlignPlugin } from "@platejs/basic-styles/react";
import { MarkdownPlugin, deserializeMd, serializeMd } from "@platejs/markdown";
import { useAppStore } from "@/lib/store";
import { FileText, Loader2, Wand2, Shrink, Expand, MessageSquare, Pen } from "lucide-react";
import { design } from "@/lib/design";
import { DocToolbar } from "./DocToolbar";

// Convert markdown string to Plate value
function mdToValue(editor: any, md: string) {
  try {
    return editor.getApi(MarkdownPlugin).markdown.deserialize(md);
  } catch {
    return [{ type: "p", children: [{ text: md || "" }] }];
  }
}

export function DocView() {
  const docContent = useAppStore((s) => s.docContent);
  const docVersion = useAppStore((s) => s.docVersion);
  const updateDocContent = useAppStore((s) => s.updateDocContent);
  const isStreaming = useAppStore((s) => s.isStreaming);
  const lastVersionRef = useRef(docVersion);
  const isAIUpdatingRef = useRef(false);

  // Inline AI edit state
  const [aiEditPrompt, setAiEditPrompt] = useState("");
  const [aiEditLoading, setAiEditLoading] = useState(false);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [selectedText, setSelectedText] = useState("");

  const plugins = useMemo(
    () => [
      BasicBlocksPlugin,
      BasicMarksPlugin,
      HighlightPlugin,
      CodeBlockPlugin,
      ListPlugin,
      LinkPlugin,
      TextAlignPlugin,
      MarkdownPlugin,
    ],
    []
  );

  const editor = usePlateEditor({
    plugins,
    value: (editor) => {
      if (!docContent) return [{ type: "p", children: [{ text: "" }] }];
      return mdToValue(editor, docContent);
    },
  });

  // Sync from store when AI updates content (docVersion changes)
  useEffect(() => {
    if (docVersion !== lastVersionRef.current && editor) {
      lastVersionRef.current = docVersion;
      isAIUpdatingRef.current = true;
      try {
        const val = mdToValue(editor, docContent || "");
        editor.tf.setValue(val);
      } catch {
        // fallback
      }
      setTimeout(() => {
        isAIUpdatingRef.current = false;
      }, 100);
    }
  }, [docVersion, docContent, editor]);

  // Sync editor changes back to store as markdown
  const handleChange = useCallback(
    ({ value }: { value: any }) => {
      if (isAIUpdatingRef.current) return;
      if (
        useAppStore.getState().currentEntityType !== "ku" &&
        useAppStore.getState().currentEntityType !== null
      )
        return;
      try {
        const md = serializeMd(editor);
        updateDocContent(md);
      } catch {
        // ignore serialization errors
      }
    },
    [editor, updateDocContent]
  );

  // Handle inline AI edit from toolbar sparkle button
  const handleAIEditFromToolbar = useCallback((text: string) => {
    setSelectedText(text);
    setShowAiPrompt(true);
    setAiEditPrompt("");
  }, []);

  // Core AI edit function — accepts a prompt string directly
  const runAIEdit = useCallback(
    async (prompt: string, text: string) => {
      if (!editor || !prompt.trim() || !text) return;
      setAiEditLoading(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: `Edit this text according to the instruction. Return ONLY the edited text, nothing else. Do not wrap in markdown fences.\n\nText: "${text}"\n\nInstruction: ${prompt}`,
              },
            ],
            sheetData: useAppStore.getState().sheets,
            docContent: useAppStore.getState().docContent,
          }),
        });

        if (!res.ok || !res.body) throw new Error("AI edit failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let result = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) result += parsed.text;
            } catch {
              // Skip malformed chunks
            }
          }
        }

        // Clean up AI response
        let cleaned = result.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned
            .replace(/^```\w*\n?/, "")
            .replace(/\n?```$/, "")
            .trim();
        }

        // Replace the selected text in the current document markdown
        const currentMd = serializeMd(editor);
        if (currentMd.includes(text)) {
          const newMd = currentMd.replace(text, cleaned);
          updateDocContent(newMd);
          // Bump version to trigger re-render
          useAppStore.setState((s) => ({
            docVersion: s.docVersion + 1,
          }));
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production")
          console.error("AI edit error:", err);
      } finally {
        setAiEditLoading(false);
        setShowAiPrompt(false);
        setAiEditPrompt("");
        setSelectedText("");
      }
    },
    [editor, updateDocContent]
  );

  // Legacy wrapper for the modal flow
  const executeAIEdit = useCallback(async () => {
    if (!aiEditPrompt.trim() || !selectedText) return;
    await runAIEdit(aiEditPrompt.trim(), selectedText);
  }, [runAIEdit, aiEditPrompt, selectedText]);

  // Bubble menu quick actions
  const handleBubbleAction = useCallback(
    (action: string) => {
      if (!editor) return;
      const sel = editor.selection;
      if (!sel) return;
      const text = editor.api.string(sel);
      if (!text?.trim()) return;

      const prompts: Record<string, string> = {
        improve:
          "Improve this text for clarity, grammar, and readability. Keep the same meaning and approximate length.",
        shorten:
          "Make this text more concise. Remove unnecessary words while preserving the core meaning.",
        expand:
          "Expand on this text with more detail, examples, or elaboration. Keep the same tone.",
        formal: "Rewrite this text in a formal, professional tone.",
        casual:
          "Rewrite this text in a casual, friendly conversational tone.",
      };

      if (action === "custom") {
        setSelectedText(text);
        setShowAiPrompt(true);
        setAiEditPrompt("");
        return;
      }

      const prompt = prompts[action];
      if (prompt) {
        setSelectedText(text);
        runAIEdit(prompt, text);
      }
    },
    [editor, runAIEdit]
  );

  // Custom floating bubble menu — tracks selection position
  const [bubblePos, setBubblePos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [showBubble, setShowBubble] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Track selection changes for bubble menu
  useEffect(() => {
    const checkSelection = () => {
      if (!editor || aiEditLoading) {
        setShowBubble(false);
        return;
      }
      const sel = editor.selection;
      if (!sel || !sel.anchor || !sel.focus) {
        setShowBubble(false);
        return;
      }
      // Check if selection is collapsed
      const isCollapsed =
        sel.anchor.path.join(",") === sel.focus.path.join(",") &&
        sel.anchor.offset === sel.focus.offset;
      if (isCollapsed) {
        setShowBubble(false);
        return;
      }
      const text = editor.api.string(sel);
      if (!text || text.trim().length <= 2) {
        setShowBubble(false);
        return;
      }
      // Position bubble near the top of the container
      const container = editorContainerRef.current;
      if (!container) return;
      try {
        const domSel = window.getSelection();
        if (!domSel || domSel.rangeCount === 0) return;
        const range = domSel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        setBubblePos({
          top: rect.top - containerRect.top - 44,
          left: rect.left - containerRect.left,
        });
        setShowBubble(true);
      } catch {
        setShowBubble(false);
      }
    };

    document.addEventListener("selectionchange", checkSelection);
    return () => document.removeEventListener("selectionchange", checkSelection);
  }, [editor, aiEditLoading]);

  const isEmpty = !docContent || docContent.trim().length === 0;

  return (
    <div
      className="h-full flex flex-col relative"
      style={{ backgroundColor: design.colors.bg.primary }}
    >
      {/* Toolbar */}
      <DocToolbar editor={editor} onAIEdit={handleAIEditFromToolbar} />

      {/* AI Edit Loading Overlay */}
      {aiEditLoading && !showAiPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/5 backdrop-blur-[1px]">
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border"
            style={{
              backgroundColor: design.colors.bg.elevated,
              borderColor: design.colors.border.default,
              boxShadow: design.shadows.lg,
            }}
          >
            <Loader2
              className="w-4 h-4 animate-spin"
              style={{ color: design.colors.brand.primary }}
            />
            <span
              className="text-[12px] font-medium"
              style={{ color: design.colors.text.primary }}
            >
              Editing with AI...
            </span>
          </div>
        </div>
      )}

      {/* AI Edit Prompt Modal */}
      {showAiPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
          <div
            className="w-full max-w-[400px] rounded-lg border p-4 mx-4 animate-scale-in"
            style={{
              backgroundColor: design.colors.bg.elevated,
              borderColor: design.colors.border.default,
              boxShadow: design.shadows.xl,
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Wand2
                className="w-4 h-4"
                style={{ color: design.colors.accent.gold }}
                strokeWidth={2}
              />
              <span
                className="text-heading-sm"
                style={{ color: design.colors.text.primary }}
              >
                AI Edit
              </span>
            </div>
            <p
              className="text-[11px] mb-3 px-2 py-1.5 rounded-lg"
              style={{
                color: design.colors.text.secondary,
                backgroundColor: design.colors.bg.secondary,
              }}
            >
              &ldquo;
              {selectedText.length > 100
                ? selectedText.slice(0, 100) + "..."
                : selectedText}
              &rdquo;
            </p>
            <input
              type="text"
              value={aiEditPrompt}
              onChange={(e) => setAiEditPrompt(e.target.value)}
              placeholder="Make it more concise, fix grammar, change tone..."
              className="w-full text-[12px] px-3 py-2 rounded-lg border outline-none mb-3"
              style={{
                backgroundColor: design.colors.bg.primary,
                borderColor: design.colors.border.default,
                color: design.colors.text.primary,
              }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) executeAIEdit();
                if (e.key === "Escape") {
                  setShowAiPrompt(false);
                  setAiEditPrompt("");
                }
              }}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowAiPrompt(false);
                  setAiEditPrompt("");
                }}
                className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: design.colors.text.secondary }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    design.colors.bg.secondary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                Cancel
              </button>
              <button
                onClick={executeAIEdit}
                disabled={!aiEditPrompt.trim() || aiEditLoading}
                className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                style={{
                  backgroundColor: design.colors.brand.primary,
                  color: design.colors.brand.text,
                }}
              >
                {aiEditLoading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" /> Editing...
                  </>
                ) : (
                  "Apply"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor area */}
      <div ref={editorContainerRef} className="flex-1 overflow-y-auto relative">
        {/* Floating AI Bubble Menu */}
        {showBubble && bubblePos && (
          <div
            ref={bubbleRef}
            className="absolute z-40 animate-fade-in"
            style={{
              top: bubblePos.top,
              left: Math.max(8, bubblePos.left - 100),
            }}
          >
            <div
              className="flex items-center gap-0.5 rounded-lg border px-1 py-0.5"
              style={{
                backgroundColor: design.colors.bg.elevated,
                borderColor: design.colors.border.default,
                boxShadow: design.shadows.lg,
              }}
            >
              <BubbleButton
                icon={<Wand2 className="w-3.5 h-3.5" />}
                label="Improve"
                onClick={() => {
                  setShowBubble(false);
                  handleBubbleAction("improve");
                }}
                color={design.colors.brand.primary}
              />
              <BubbleButton
                icon={<Shrink className="w-3.5 h-3.5" />}
                label="Shorten"
                onClick={() => {
                  setShowBubble(false);
                  handleBubbleAction("shorten");
                }}
                color={design.colors.accent.purple}
              />
              <BubbleButton
                icon={<Expand className="w-3.5 h-3.5" />}
                label="Expand"
                onClick={() => {
                  setShowBubble(false);
                  handleBubbleAction("expand");
                }}
                color={design.colors.accent.gold}
              />
              <div
                className="w-px h-5 mx-0.5"
                style={{
                  backgroundColor: design.colors.border.default,
                }}
              />
              <BubbleButton
                icon={<MessageSquare className="w-3.5 h-3.5" />}
                label="Formal"
                onClick={() => {
                  setShowBubble(false);
                  handleBubbleAction("formal");
                }}
                color={design.colors.text.secondary}
              />
              <BubbleButton
                icon={<Pen className="w-3.5 h-3.5" />}
                label="Custom"
                onClick={() => {
                  setShowBubble(false);
                  handleBubbleAction("custom");
                }}
                color={design.colors.text.secondary}
              />
            </div>
          </div>
        )}
        {isEmpty && !isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-3 text-center px-8">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  backgroundColor: design.colors.accent.purpleSubtle,
                }}
              >
                <FileText
                  className="w-6 h-6"
                  style={{ color: design.colors.accent.purple }}
                  strokeWidth={1.5}
                />
              </div>
              <div>
                <p
                  className="text-heading-sm mb-1"
                  style={{ color: design.colors.text.secondary }}
                >
                  Your document will appear here
                </p>
                <p
                  className="text-ui-sm max-w-[280px]"
                  style={{
                    color: design.colors.text.muted,
                    fontWeight: 400,
                  }}
                >
                  Ask the AI to draft, outline, brainstorm, or write any content
                </p>
              </div>
            </div>
          </div>
        )}
        <Plate editor={editor} onChange={handleChange}>
          <PlateContent
            className="doc-editor focus:outline-none px-8 py-6 min-h-full"
            placeholder="Start writing, or ask the AI to draft something..."
          />
        </Plate>
        {isStreaming && <StreamingBar />}
      </div>
    </div>
  );
}

function BubbleButton({
  icon,
  label,
  onClick,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors hover:bg-black/5"
      style={{ color }}
      title={label}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function StreamingBar() {
  return (
    <div className="absolute top-0 left-0 right-0 z-50">
      <div
        className="h-[2px] w-full overflow-hidden"
        style={{ backgroundColor: design.colors.brand.subtle }}
      >
        <div
          className="h-full animate-progress-bar"
          style={{ backgroundColor: design.colors.brand.primary }}
        />
      </div>
    </div>
  );
}
