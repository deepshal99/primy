"use client";

import type { PlateEditor } from "platejs/react";
import { insertLink, unwrapLink } from "@platejs/link";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Minus,
  Undo,
  Redo,
  Link,
  Wand2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from "lucide-react";
import { useState, useCallback } from "react";
import { design } from "@/lib/design";

interface DocToolbarProps {
  editor: PlateEditor | null;
  onAIEdit?: (selectedText: string) => void;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-7 h-7 flex items-center justify-center rounded-md transition-colors duration-100 disabled:opacity-30"
      style={{
        backgroundColor: isActive ? design.colors.bg.tertiary : "transparent",
        color: isActive
          ? design.colors.text.primary
          : design.colors.text.secondary,
      }}
      onMouseEnter={(e) => {
        if (!isActive)
          e.currentTarget.style.backgroundColor = design.colors.bg.hover;
      }}
      onMouseLeave={(e) => {
        if (!isActive)
          e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <div
      className="w-px h-5 mx-0.5"
      style={{ backgroundColor: design.colors.border.light }}
    />
  );
}

export function DocToolbar({ editor, onAIEdit }: DocToolbarProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const setLink = useCallback(() => {
    if (!editor) return;
    if (linkUrl) {
      insertLink(editor as any, { url: linkUrl });
    } else {
      unwrapLink(editor as any);
    }
    setShowLinkInput(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  const handleAIEdit = useCallback(() => {
    if (!editor || !onAIEdit) return;
    const sel = editor.selection;
    if (!sel) return;
    const text = editor.api.string(sel);
    if (text?.trim()) {
      onAIEdit(text);
    }
  }, [editor, onAIEdit]);

  if (!editor) return null;

  // Helper to check if a mark is active
  const isMark = (mark: string) => {
    try {
      const marks = (editor as any).getMarks?.() ?? editor.marks;
      return marks ? !!(marks as any)[mark] : false;
    } catch {
      return false;
    }
  };

  // Helper to check if a block type is active at selection
  const isBlock = (type: string) => {
    try {
      if (!editor.selection) return false;
      const nodes = Array.from(
        editor.api.nodes({
          at: editor.selection,
          match: (n: any) => n.type === type,
        })
      );
      return nodes.length > 0;
    } catch {
      return false;
    }
  };

  // Check if selection is collapsed (empty)
  const isSelectionEmpty =
    !editor.selection ||
    (editor.selection.anchor.path.join(",") ===
      editor.selection.focus.path.join(",") &&
      editor.selection.anchor.offset === editor.selection.focus.offset);

  return (
    <div
      className="flex items-center gap-0.5 px-2 py-1.5 border-b flex-wrap"
      style={{
        backgroundColor: design.colors.bg.secondary,
        borderColor: design.colors.border.default,
      }}
    >
      {/* Undo/Redo */}
      <ToolbarButton onClick={() => editor.undo()} title="Undo">
        <Undo className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.redo()} title="Redo">
        <Redo className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>

      <Divider />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.tf.toggleBlock("h1")}
        isActive={isBlock("h1")}
        title="Heading 1"
      >
        <Heading1 className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.tf.toggleBlock("h2")}
        isActive={isBlock("h2")}
        title="Heading 2"
      >
        <Heading2 className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.tf.toggleBlock("h3")}
        isActive={isBlock("h3")}
        title="Heading 3"
      >
        <Heading3 className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>

      <Divider />

      {/* Inline formatting */}
      <ToolbarButton
        onClick={() => editor.tf.toggleMark("bold")}
        isActive={isMark("bold")}
        title="Bold"
      >
        <Bold className="w-3.5 h-3.5" strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.tf.toggleMark("italic")}
        isActive={isMark("italic")}
        title="Italic"
      >
        <Italic className="w-3.5 h-3.5" strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.tf.toggleMark("underline")}
        isActive={isMark("underline")}
        title="Underline"
      >
        <UnderlineIcon className="w-3.5 h-3.5" strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.tf.toggleMark("strikethrough")}
        isActive={isMark("strikethrough")}
        title="Strikethrough"
      >
        <Strikethrough className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.tf.toggleMark("code")}
        isActive={isMark("code")}
        title="Inline code"
      >
        <Code className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.tf.toggleMark("highlight")}
        isActive={isMark("highlight")}
        title="Highlight"
      >
        <span
          className="w-3.5 h-3.5 flex items-center justify-center text-[10px] font-bold"
          style={{ color: design.colors.accent.gold }}
        >
          H
        </span>
      </ToolbarButton>

      <Divider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.tf.toggleBlock("ul")}
        isActive={isBlock("ul")}
        title="Bullet list"
      >
        <List className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.tf.toggleBlock("ol")}
        isActive={isBlock("ol")}
        title="Numbered list"
      >
        <ListOrdered className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.tf.toggleBlock("action_item")}
        isActive={isBlock("action_item")}
        title="Task list"
      >
        <ListChecks className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>

      <Divider />

      {/* Block elements */}
      <ToolbarButton
        onClick={() => editor.tf.toggleBlock("blockquote")}
        isActive={isBlock("blockquote")}
        title="Quote"
      >
        <Quote className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() =>
          editor.tf.insertNodes({ type: "hr", children: [{ text: "" }] } as any)
        }
        title="Divider"
      >
        <Minus className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>

      <Divider />

      {/* Text Alignment */}
      <ToolbarButton
        onClick={() =>
          editor.tf.setNodes({ textAlign: "left" } as any, {
            match: (n: any) => editor.api.isBlock(n),
          })
        }
        title="Align left"
      >
        <AlignLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() =>
          editor.tf.setNodes({ textAlign: "center" } as any, {
            match: (n: any) => editor.api.isBlock(n),
          })
        }
        title="Align center"
      >
        <AlignCenter className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() =>
          editor.tf.setNodes({ textAlign: "right" } as any, {
            match: (n: any) => editor.api.isBlock(n),
          })
        }
        title="Align right"
      >
        <AlignRight className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() =>
          editor.tf.setNodes({ textAlign: "justify" } as any, {
            match: (n: any) => editor.api.isBlock(n),
          })
        }
        title="Justify"
      >
        <AlignJustify className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>

      <Divider />

      {/* Link */}
      <div className="relative">
        <ToolbarButton
          onClick={() => {
            if (isBlock("a")) {
              unwrapLink(editor as any);
            } else {
              setShowLinkInput(!showLinkInput);
            }
          }}
          isActive={isBlock("a")}
          title="Link"
        >
          <Link className="w-3.5 h-3.5" strokeWidth={1.5} />
        </ToolbarButton>
        {showLinkInput && (
          <div
            className="absolute top-full left-0 mt-1 z-50 flex items-center gap-1 p-1.5 rounded-lg border"
            style={{
              backgroundColor: design.colors.bg.elevated,
              borderColor: design.colors.border.default,
              boxShadow: design.shadows.dropdown,
            }}
          >
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="text-[11px] px-2 py-1 rounded border outline-none w-[200px]"
              style={{
                backgroundColor: design.colors.bg.primary,
                borderColor: design.colors.border.default,
                color: design.colors.text.primary,
              }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") setLink();
                if (e.key === "Escape") {
                  setShowLinkInput(false);
                  setLinkUrl("");
                }
              }}
            />
            <button
              onClick={setLink}
              className="text-[10px] font-medium px-2 py-1 rounded"
              style={{
                backgroundColor: design.colors.brand.primary,
                color: design.colors.brand.text,
              }}
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* AI Edit */}
      {onAIEdit && (
        <>
          <Divider />
          <ToolbarButton
            onClick={handleAIEdit}
            disabled={isSelectionEmpty}
            title="AI Edit -- select text first"
          >
            <Wand2
              className="w-3.5 h-3.5"
              strokeWidth={1.5}
              style={{ color: design.colors.accent.gold }}
            />
          </ToolbarButton>
        </>
      )}
    </div>
  );
}
