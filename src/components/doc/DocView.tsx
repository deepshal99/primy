"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Plate, PlateContent, usePlateEditor, createPlatePlugin, useEditorRef } from "platejs/react";
import {
  BasicBlocksPlugin,
  BasicMarksPlugin,
  HighlightPlugin,
} from "@platejs/basic-nodes/react";
import { CodeBlockPlugin } from "@platejs/code-block/react";
import { ListPlugin } from "@platejs/list-classic/react";
import { LinkPlugin } from "@platejs/link/react";
import { TextAlignPlugin } from "@platejs/basic-styles/react";
import { MarkdownPlugin, serializeMd } from "@platejs/markdown";
import remarkGfm from "remark-gfm";
import { TablePlugin } from "@platejs/table/react";
import { ImagePlugin } from "@platejs/media/react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { parseEntityUri, useBacklinks, openEntity } from "@/lib/entityLinks";
import { ENTITY_META } from "@/lib/entityMeta";
import {
  Loader2,
  Wand2,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { DocToolbar } from "./DocToolbar";
import { SelectionBubble } from "./SelectionBubble";
import { MentionElement } from "./mention/MentionElement";
import { MentionCombobox } from "./mention/MentionCombobox";

// HR void element plugin
function HrElement({ attributes, children }: any) {
  return (
    <div {...attributes} contentEditable={false}>
      <hr className="my-4 border-t border-border" />
      {children}
    </div>
  );
}

const HrPlugin = createPlatePlugin({
  key: "hr",
  node: {
    isElement: true,
    isVoid: true,
    component: HrElement,
  },
});

// Image element component with controls
function ImageElement({ attributes, children, element }: any) {
  const editor = useEditorRef();
  const [selected, setSelected] = useState(false);
  const [width, setWidth] = useState<number | undefined>(element.width);
  const [align, setAlign] = useState<"left" | "center" | "right">(element.align || "center");
  const containerRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  // Detach an in-progress resize drag if the node unmounts mid-drag (AI
  // setValue / delete), so the document listeners don't leak and handleMove
  // doesn't keep firing setWidth on an unmounted node.
  const dragCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => dragCleanupRef.current?.(), []);

  const updateNode = useCallback(
    (props: Record<string, any>) => {
      const path = editor.api.findPath(element);
      if (path) {
        editor.tf.setNodes(props, { at: path });
      }
    },
    [editor, element]
  );

  const handleDelete = useCallback(() => {
    const path = editor.api.findPath(element);
    if (path) {
      editor.tf.removeNodes({ at: path });
    }
  }, [editor, element]);

  const handleAlign = useCallback(
    (newAlign: "left" | "center" | "right") => {
      setAlign(newAlign);
      updateNode({ align: newAlign });
    },
    [updateNode]
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizingRef.current = true;
      startXRef.current = e.clientX;
      const img = containerRef.current?.querySelector("img");
      startWidthRef.current = img?.offsetWidth || 400;

      const handleMove = (ev: MouseEvent) => {
        if (!resizingRef.current) return;
        const delta = ev.clientX - startXRef.current;
        const newWidth = Math.max(100, Math.min(800, startWidthRef.current + delta));
        setWidth(newWidth);
      };
      const detach = () => {
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleUp);
        dragCleanupRef.current = null;
      };
      const handleUp = () => {
        resizingRef.current = false;
        detach();
        // Persist width to node
        const img = containerRef.current?.querySelector("img");
        if (img) updateNode({ width: img.offsetWidth });
      };
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleUp);
      dragCleanupRef.current = detach;
    },
    [updateNode]
  );

  const toggleSize = useCallback(() => {
    if (width && width < 700) {
      setWidth(undefined); // full width
      updateNode({ width: undefined });
    } else {
      setWidth(400);
      updateNode({ width: 400 });
    }
  }, [width, updateNode]);

  const justifyClass =
    align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";

  return (
    <div
      {...attributes}
      contentEditable={false}
      ref={containerRef}
      className={`my-4 flex ${justifyClass} group/img relative`}
      onClick={() => setSelected(true)}
      onBlur={() => setSelected(false)}
      tabIndex={-1}
    >
      <div className="relative inline-block">
        <img
          src={element.url}
          alt={element.caption || ""}
          className={`rounded-lg border transition-shadow ${selected ? "border-[#FFB43F]/40 shadow-[0_0_0_2px_rgba(255,180,63,0.1)]" : "border-border"}`}
          style={{ maxHeight: 500, width: width ? `${width}px` : undefined, maxWidth: "100%" }}
          draggable={false}
        />

        {/* Toolbar — visible on hover or when selected */}
        <div
          className={`absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1 py-0.5 rounded-lg bg-card border border-border shadow-md transition-opacity ${
            selected ? "opacity-100" : "opacity-0 group-hover/img:opacity-100"
          }`}
        >
          {([
            { icon: AlignLeft, value: "left" as const, label: "Left" },
            { icon: AlignCenter, value: "center" as const, label: "Center" },
            { icon: AlignRight, value: "right" as const, label: "Right" },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleAlign(opt.value); }}
              className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
                align === opt.value ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
              title={opt.label}
            >
              <opt.icon className="w-3.5 h-3.5" />
            </button>
          ))}

          <div className="w-px h-4 bg-border mx-0.5" />

          <button
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleSize(); }}
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
            title={width && width < 700 ? "Full width" : "Smaller"}
          >
            {width && width < 700 ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>

          <div className="w-px h-4 bg-border mx-0.5" />

          <button
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(); }}
            className="w-7 h-7 flex items-center justify-center rounded-md text-red-500/70 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete image"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right resize handle */}
        <div
          onMouseDown={handleResizeStart}
          className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-10 rounded-full cursor-ew-resize transition-opacity ${
            selected ? "opacity-100 bg-[#FFB43F]/60" : "opacity-0 group-hover/img:opacity-60 bg-muted-foreground/40"
          }`}
        />
      </div>
      {children}
    </div>
  );
}

// Table element components with add row/column controls
function TableElement({ attributes, children, element }: any) {
  const editor = useEditorRef();

  const addRow = () => {
    // Count columns from first row
    const firstRow = element.children?.[0];
    const colCount = firstRow?.children?.length || 3;
    const cells = Array.from({ length: colCount }, () => ({
      type: "td",
      children: [{ type: "p", children: [{ text: "" }] }],
    }));
    const newRow = { type: "tr", children: cells };
    const path = editor.api.findPath(element);
    if (path) {
      editor.tf.insertNodes(newRow as any, {
        at: [...path, element.children.length],
      });
    }
  };

  const addColumn = () => {
    const path = editor.api.findPath(element);
    if (!path) return;
    for (let i = 0; i < element.children.length; i++) {
      const row = element.children[i];
      const isHeader = row.children?.[0]?.type === "th";
      const newCell = {
        type: isHeader ? "th" : "td",
        children: [{ type: "p", children: [{ text: "" }] }],
      };
      editor.tf.insertNodes(newCell as any, {
        at: [...path, i, row.children.length],
      });
    }
  };

  return (
    <div {...attributes} className="my-4 group/table relative">
      <table className="doc-editor w-full border-collapse">
        <tbody>{children}</tbody>
      </table>
      {/* Add row button */}
      <button
        contentEditable={false}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); addRow(); }}
        className="w-full h-6 flex items-center justify-center rounded-b-lg border border-t-0 border-border text-[11px] text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50 transition-colors opacity-0 group-hover/table:opacity-100 cursor-pointer"
      >
        + Row
      </button>
      {/* Add column button */}
      <button
        contentEditable={false}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); addColumn(); }}
        className="absolute -right-7 top-0 w-6 h-full flex items-center justify-center rounded-r-lg border border-l-0 border-border text-[11px] text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50 transition-colors opacity-0 group-hover/table:opacity-100 cursor-pointer"
        style={{ writingMode: "vertical-rl" }}
      >
        + Col
      </button>
    </div>
  );
}

function TableRowElement({ attributes, children }: any) {
  return <tr {...attributes}>{children}</tr>;
}

function TableCellElement({ attributes, children }: any) {
  return (
    <td {...attributes} className="border border-border p-2 min-w-[60px]">
      {children}
    </td>
  );
}

function TableHeaderCellElement({ attributes, children }: any) {
  return (
    <th {...attributes} className="border border-border p-2 min-w-[60px] bg-muted font-semibold">
      {children}
    </th>
  );
}

// Convert any link node whose url is drafta:// into a mention node, recursively.
// Also drops malformed image nodes whose url isn't a usable string — those
// otherwise render as a broken "[object Object]" image (e.g. when the model
// tries to embed an uploaded image that has no durable URL).
function isUsableImageUrl(url: unknown): url is string {
  return typeof url === "string" && /^(https?:|data:)/.test(url.trim());
}

function hydrateMentions(nodes: any[]): any[] {
  if (!Array.isArray(nodes)) return nodes;
  return nodes
    .filter((n) => {
      if (n && (n.type === "img" || n.type === "image")) {
        return isUsableImageUrl(n.url ?? n.src);
      }
      return true;
    })
    .map((n) => {
    if (n && (n.type === "a" || n.type === "link")) {
      const url: string = n.url || n.href || "";
      const parsed = parseEntityUri(url);
      if (parsed) {
        const text = (n.children?.[0]?.text ?? n.children?.[0]?.value ?? "").replace(/^@/, "");
        return {
          type: "mention",
          entityType: parsed.type,
          entityId: parsed.id,
          value: text,
          children: [{ text: "" }],
        };
      }
    }
    if (Array.isArray(n?.children)) {
      return { ...n, children: hydrateMentions(n.children) };
    }
    return n;
  });
}

function mdToValue(editor: any, md: string) {
  try {
    const value = editor.getApi(MarkdownPlugin).markdown.deserialize(md);
    return hydrateMentions(value);
  } catch {
    return [{ type: "p", children: [{ text: md || "" }] }];
  }
}

export function DocView() {
  const docContent = useAppStore((s) => s.docContent);
  const docVersion = useAppStore((s) => s.docVersion);
  const updateDocContent = useAppStore((s) => s.updateDocContent);
  const isStreaming = useAppStore((s) => s.isStreaming);
  const aiPhase = useAppStore((s) => s.aiPhase);
  const lastVersionRef = useRef(docVersion);
  const isAIUpdatingRef = useRef(false);

  const [aiEditPrompt, setAiEditPrompt] = useState("");
  const [aiEditLoading, setAiEditLoading] = useState(false);
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [selectedText, setSelectedText] = useState("");

  const editorContainerRef = useRef<HTMLDivElement>(null);

  const plugins = useMemo(
    () => [
      BasicBlocksPlugin,
      BasicMarksPlugin,
      HighlightPlugin,
      CodeBlockPlugin,
      ListPlugin,
      LinkPlugin,
      TextAlignPlugin,
      MarkdownPlugin.configure({
        options: {
          remarkPlugins: [remarkGfm],
          rules: {
            mention: {
              serialize: (node: any) => ({
                type: "link",
                url: `drafta://${node.entityType}/${node.entityId}`,
                children: [{ type: "text", value: `@${node.value || ""}` }],
              }),
            },
          },
        },
      }),
      HrPlugin,
      TablePlugin.configure({
        render: { node: TableElement },
      }),
      createPlatePlugin({
        key: "tr",
        node: { isElement: true, component: TableRowElement },
      }),
      createPlatePlugin({
        key: "td",
        node: { isElement: true, component: TableCellElement },
      }),
      createPlatePlugin({
        key: "th",
        node: { isElement: true, component: TableHeaderCellElement },
      }),
      ImagePlugin.configure({
        render: { node: ImageElement },
      }),
      createPlatePlugin({
        key: "mention",
        node: {
          isElement: true,
          isInline: true,
          isVoid: true,
          component: MentionElement,
        },
      }),
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
      // Genuine user typing (AI applies are gated above) — mark active editing.
      useAppStore.getState().noteEditorInteraction();
      try {
        const md = serializeMd(editor);
        updateDocContent(md);
      } catch {
        // ignore serialization errors
      }
    },
    [editor, updateDocContent]
  );

  // Core AI edit function
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
        let streamError: string | null = null;

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
              else if (parsed.error) streamError = String(parsed.error);
            } catch {
              // skip
            }
          }
        }

        let cleaned = result.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```\w*\n?/, "").replace(/\n?```$/, "").trim();
        }

        // Never overwrite the selection with nothing: a stream error or empty
        // result would otherwise delete the user's selected text silently.
        if (streamError || !cleaned) {
          toast.error("AI edit failed. Your text was left unchanged.");
          return;
        }

        const currentMd = serializeMd(editor);
        if (currentMd.includes(text)) {
          // Function replacer so `$&`, `$1`, `$$` etc. in the AI output are
          // inserted literally instead of being treated as replacement patterns.
          const newMd = currentMd.replace(text, () => cleaned);
          updateDocContent(newMd);
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

  const executeAIEdit = useCallback(async () => {
    if (!aiEditPrompt.trim() || !selectedText) return;
    await runAIEdit(aiEditPrompt.trim(), selectedText);
  }, [runAIEdit, aiEditPrompt, selectedText]);

  const isEmpty = !docContent || docContent.trim().length === 0;

  // Get current entity name for AI banner
  const currentEntityId = useAppStore((s) => s.currentEntityId);
  const currentEntityType = useAppStore((s) => s.currentEntityType);
  const backlinks = useBacklinks(currentEntityType === "ku" ? currentEntityId : null);
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const projects = useAppStore((s) => s.projects);
  let entityName = "document";
  if (currentEntityId && currentProjectId) {
    const project = projects.find((p) => p.id === currentProjectId);
    if (project) {
      const ku = project.knowledgeUnits?.find((k) => k.id === currentEntityId);
      if (ku) entityName = ku.title;
    }
  }

  const isAiUpdating = aiPhase === "streaming" || aiPhase === "updating";

  return (
    <div className="h-full flex flex-col relative bg-background">
      {/* Toolbar */}
      <DocToolbar editor={editor} />

      {/* AI Edit Loading Overlay */}
      {aiEditLoading && !showAiPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/5 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card shadow-lg">
            <Loader2 className="w-4 h-4 animate-spin text-[#FFB43F]" />
            <span className="text-xs font-medium text-foreground">
              Editing with AI...
            </span>
          </div>
        </div>
      )}

      {/* AI Edit Prompt Modal */}
      {showAiPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
          <div className="w-full max-w-[400px] rounded-xl border border-border bg-card p-4 mx-4 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 mb-3">
              <Wand2 className="w-4 h-4 text-amber-500" strokeWidth={2} />
              <span className="text-sm font-semibold text-foreground">AI Edit</span>
            </div>
            <p className="text-xs mb-3 px-2 py-1.5 rounded-lg bg-muted text-muted-foreground">
              &ldquo;{selectedText.length > 100 ? selectedText.slice(0, 100) + "..." : selectedText}&rdquo;
            </p>
            <input
              type="text"
              value={aiEditPrompt}
              onChange={(e) => setAiEditPrompt(e.target.value)}
              placeholder="Make it more concise, fix grammar, change tone..."
              className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-[#FFB43F]/30 focus:border-[#FFB43F] mb-3 transition-all"
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
                className="text-xs font-medium px-3 py-1.5 rounded-lg text-muted-foreground hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeAIEdit}
                disabled={!aiEditPrompt.trim() || aiEditLoading}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
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

      {/* AI Updating Banner */}
      {isAiUpdating && (
        <div className="flex items-center gap-2.5 px-5 py-2 bg-[rgba(255,180,63,0.08)] border-b border-[#FFB43F]/15">
          <div className="w-3.5 h-3.5 flex flex-col items-start justify-center gap-[2px] flex-shrink-0">
            <div className="h-[1.5px] rounded-full bg-[#FFB43F]/60 content-loader-line" style={{ width: "100%" }} />
            <div className="h-[1.5px] rounded-full bg-[#FFB43F]/40 content-loader-line" style={{ width: "70%" }} />
            <div className="h-[1.5px] rounded-full bg-[#FFB43F]/25 content-loader-line" style={{ width: "85%" }} />
          </div>
          <span className="text-[12px] text-[#B87426] font-medium">
            AI is updating {entityName}...
          </span>
        </div>
      )}

      {/* Editor Area */}
      <div ref={editorContainerRef} className="flex-1 overflow-y-auto relative">
        <style>{`
          .doc-editor ::selection {
            background: rgba(255, 180, 63, 0.20);
            color: inherit;
          }
          .doc-editor *::selection {
            background: rgba(255, 180, 63, 0.20);
            color: inherit;
          }
          @keyframes highlightFade {
            0% { background-color: rgba(255, 180, 63, 0.14); }
            100% { background-color: transparent; }
          }
          .ai-inserted-highlight {
            animation: highlightFade 4s ease-out forwards;
          }
        `}</style>

        {isEmpty && !isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-4 text-center px-8 animate-fade-in">
              {/* Mini doc illustration */}
              <div
                className="relative w-[52px] h-[60px] rounded-[8px] bg-white"
                style={{
                  border: "1px solid rgba(74, 122, 237, 0.25)",
                  boxShadow: "0 2px 8px rgba(74, 122, 237, 0.08)",
                }}
                aria-hidden
              >
                <div className="absolute inset-x-3 top-3 h-[2.5px] rounded-full bg-[rgba(74,122,237,0.45)]" />
                <div className="absolute inset-x-3 top-[18px] h-[2px] rounded-full bg-[rgba(74,122,237,0.25)]" />
                <div className="absolute inset-x-3 top-[26px] h-[2px] w-[70%] rounded-full bg-[rgba(74,122,237,0.20)]" />
                <div className="absolute inset-x-3 top-[34px] h-[2px] rounded-full bg-[rgba(74,122,237,0.20)]" />
                <div className="absolute inset-x-3 top-[42px] h-[2px] w-[55%] rounded-full bg-[rgba(74,122,237,0.18)]" />
              </div>
              <div>
                <p className="text-[14px] font-medium mb-1 text-foreground font-heading tracking-[-0.01em]">
                  Start writing or ask AI
                </p>
                <p className="text-[12.5px] max-w-[300px] text-muted-foreground leading-relaxed">
                  Click anywhere to begin, or describe what you need in chat.
                </p>
              </div>
            </div>
          </div>
        )}
        <Plate editor={editor} onChange={handleChange}>
          <PlateContent
            className="doc-editor focus:outline-none px-12 py-10 min-h-full max-w-[800px] mx-auto"
            style={{ lineHeight: "1.8" }}
            placeholder="Start writing or ask AI…"
          />
          {/* Selection Bubble - must be inside <Plate> for editor.selection access */}
          <SelectionBubble editor={editor} containerRef={editorContainerRef} />
          {/* @-mention combobox - inside <Plate> so useEditorRef() resolves */}
          <MentionCombobox />
        </Plate>

        {/* Backlinks footer */}
        {backlinks.length > 0 && (
          <div className="mx-auto w-full mt-10 mb-16 max-w-[800px] px-12">
            <div className="border-t border-border pt-4">
              <div
                className="text-[11px] font-medium uppercase tracking-wide mb-2"
                style={{ color: "var(--ink-3)" }}
              >
                Linked from
              </div>
              <div className="flex flex-wrap gap-1.5">
                {backlinks.map((b) => {
                  const meta = ENTITY_META[b.type] || ENTITY_META.ku;
                  const Icon = meta.Icon;
                  return (
                    <button
                      key={`${b.type}:${b.id}`}
                      type="button"
                      onClick={() => openEntity(b.type, b.id)}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border text-xs press"
                      style={{ backgroundColor: "var(--card)", color: "var(--ink)" }}
                      title={`Open ${meta.label.toLowerCase()}: ${b.title}`}
                    >
                      <Icon size={12} strokeWidth={2} style={{ color: "var(--icon, currentColor)" }} aria-hidden />
                      <span className="truncate max-w-[200px]">{b.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {isStreaming && <StreamingBar />}
      </div>

      {/* Status bar */}
      <DocStatusBar />
    </div>
  );
}

function DocStatusBar() {
  const docContent = useAppStore((s) => s.docContent);
  const isSaving = useAppStore((s) => s.isSaving);
  const lastSavedAt = useAppStore((s) => s.lastSavedAt);

  const wordCount = useMemo(() => {
    if (!docContent) return 0;
    return docContent.trim().split(/\s+/).filter(Boolean).length;
  }, [docContent]);

  const charCount = useMemo(() => {
    if (!docContent) return 0;
    return docContent.length;
  }, [docContent]);

  return (
    <div
      className="flex items-center justify-between px-5 h-7 flex-shrink-0 text-[11px] select-none"
      style={{ borderTop: "1px solid var(--border)", color: "var(--ink-3)" }}
    >
      <div className="flex items-center gap-2 tabular-nums">
        <span>{wordCount.toLocaleString()} words</span>
        <span style={{ color: "var(--ink-4)" }}>·</span>
        <span>{charCount.toLocaleString()} characters</span>
      </div>
      <div className="flex items-center gap-1.5">
        {isSaving ? (
          <>
            <span
              className="w-1 h-1 rounded-full"
              style={{ backgroundColor: "var(--accent-amber)" }}
            />
            <span>Saving…</span>
          </>
        ) : lastSavedAt > 0 ? (
          <span>Saved</span>
        ) : null}
      </div>
    </div>
  );
}

function StreamingBar() {
  return (
    <div className="absolute top-0 left-0 right-0 z-50">
      <div className="h-[2px] w-full overflow-hidden bg-[#FFB43F]/10">
        <div className="h-full animate-progress-bar bg-[#FFB43F]" />
      </div>
    </div>
  );
}
