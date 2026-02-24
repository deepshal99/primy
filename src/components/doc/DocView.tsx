"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import LinkExt from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import { Markdown } from "tiptap-markdown";
import { useEffect, useRef, useState, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { FileText, Sparkles, Loader2 } from "lucide-react";
import { design } from "@/lib/design";
import { DocToolbar } from "./DocToolbar";

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

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        codeBlock: {
          HTMLAttributes: { class: "doc-code-block" },
        },
      }),
      Placeholder.configure({
        placeholder: "Start writing, or ask the AI to draft something...",
      }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      LinkExt.configure({
        openOnClick: false,
        HTMLAttributes: { class: "doc-link" },
      }),
      Highlight.configure({
        multicolor: false,
      }),
      Markdown,
    ],
    content: docContent || "",
    editorProps: {
      attributes: {
        class: "doc-editor focus:outline-none px-8 py-6 min-h-full",
      },
    },
    onUpdate: ({ editor }) => {
      if (isAIUpdatingRef.current) return;
      const md = (editor.storage as any).markdown?.getMarkdown?.() || editor.getHTML();
      updateDocContent(md);
    },
  });

  useEffect(() => {
    if (docVersion !== lastVersionRef.current && editor) {
      lastVersionRef.current = docVersion;
      isAIUpdatingRef.current = true;
      editor.commands.setContent(docContent || "");
      setTimeout(() => {
        isAIUpdatingRef.current = false;
      }, 100);
    }
  }, [docVersion, docContent, editor]);

  // Handle inline AI edit from toolbar sparkle button
  const handleAIEditFromToolbar = useCallback((text: string) => {
    setSelectedText(text);
    setShowAiPrompt(true);
    setAiEditPrompt("");
  }, []);

  // Execute inline AI edit
  const executeAIEdit = useCallback(async () => {
    if (!editor || !aiEditPrompt.trim() || !selectedText) return;
    setAiEditLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Edit this text according to the instruction. Return ONLY the edited text, nothing else.\n\nText: "${selectedText}"\n\nInstruction: ${aiEditPrompt.trim()}`,
            },
          ],
          sheetData: "[]",
          docContent: "",
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
        // Parse SSE chunks: each line is "data: {...}\n\n"
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer
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

      // Clean up AI response (remove markdown fences if any)
      let cleaned = result.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```\w*\n?/, "").replace(/\n?```$/, "").trim();
      }

      // Replace the selected text with AI result
      const { from, to } = editor.state.selection;
      if (from !== to) {
        editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, cleaned).run();
      }
    } catch (err) {
      console.error("AI edit error:", err);
    } finally {
      setAiEditLoading(false);
      setShowAiPrompt(false);
      setAiEditPrompt("");
      setSelectedText("");
    }
  }, [editor, aiEditPrompt, selectedText]);

  const isEmpty = !docContent || docContent.trim().length === 0;

  return (
    <div className="h-full flex flex-col relative" style={{ backgroundColor: design.colors.bg.primary }}>
      {/* Toolbar */}
      <DocToolbar editor={editor} onAIEdit={handleAIEditFromToolbar} />

      {/* AI Edit Prompt Modal */}
      {showAiPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
          <div
            className="w-full max-w-[400px] rounded-xl border p-4 mx-4 animate-scale-in"
            style={{
              backgroundColor: design.colors.bg.elevated,
              borderColor: design.colors.border.default,
              boxShadow: design.shadows.xl,
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4" style={{ color: design.colors.accent.gold }} strokeWidth={2} />
              <span className="text-heading-sm" style={{ color: design.colors.text.primary }}>
                AI Edit
              </span>
            </div>
            <p className="text-[11px] mb-3 px-2 py-1.5 rounded-lg" style={{
              color: design.colors.text.secondary,
              backgroundColor: design.colors.bg.secondary,
            }}>
              &ldquo;{selectedText.length > 100 ? selectedText.slice(0, 100) + "..." : selectedText}&rdquo;
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
                if (e.key === "Escape") { setShowAiPrompt(false); setAiEditPrompt(""); }
              }}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => { setShowAiPrompt(false); setAiEditPrompt(""); }}
                className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: design.colors.text.secondary }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = design.colors.bg.secondary; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
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
                  <><Loader2 className="w-3 h-3 animate-spin" /> Editing...</>
                ) : (
                  "Apply"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto relative">
        {isEmpty && !isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-3 text-center px-8">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: design.colors.accent.purpleSubtle }}
              >
                <FileText
                  className="w-6 h-6"
                  style={{ color: design.colors.accent.purple }}
                  strokeWidth={1.5}
                />
              </div>
              <div>
                <p className="text-heading-sm mb-1" style={{ color: design.colors.text.secondary }}>
                  Your document will appear here
                </p>
                <p className="text-ui-sm max-w-[280px]" style={{ color: design.colors.text.muted, fontWeight: 400 }}>
                  Ask the AI to draft, outline, brainstorm, or write any content
                </p>
              </div>
            </div>
          </div>
        )}
        <EditorContent editor={editor} />
        {isStreaming && <StreamingBar />}
      </div>
    </div>
  );
}

function StreamingBar() {
  return (
    <div className="absolute top-0 left-0 right-0 z-50">
      <div className="h-[2px] w-full overflow-hidden" style={{ backgroundColor: design.colors.accent.purpleSubtle }}>
        <div
          className="h-full animate-progress-bar"
          style={{ backgroundColor: design.colors.accent.purple }}
        />
      </div>
    </div>
  );
}
