"use client";

import { Editor } from "@tiptap/react";
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
  Sparkles,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from "lucide-react";
import { useState, useCallback } from "react";
import { design } from "@/lib/design";

interface DocToolbarProps {
  editor: Editor | null;
  onAIEdit?: (selectedText: string) => void;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, isActive, disabled, title, children }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-7 h-7 flex items-center justify-center rounded-md transition-colors duration-100 disabled:opacity-30"
      style={{
        backgroundColor: isActive ? design.colors.bg.tertiary : "transparent",
        color: isActive ? design.colors.text.primary : design.colors.text.secondary,
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = design.colors.bg.hover;
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
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
      editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run();
    } else {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    }
    setShowLinkInput(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  const handleAIEdit = useCallback(() => {
    if (!editor || !onAIEdit) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    if (selectedText.trim()) {
      onAIEdit(selectedText);
    }
  }, [editor, onAIEdit]);

  if (!editor) return null;

  return (
    <div
      className="flex items-center gap-0.5 px-2 py-1.5 border-b flex-wrap"
      style={{
        backgroundColor: design.colors.bg.secondary,
        borderColor: design.colors.border.default,
      }}
    >
      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        <Undo className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        <Redo className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>

      <Divider />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive("heading", { level: 1 })}
        title="Heading 1"
      >
        <Heading1 className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
      >
        <Heading2 className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive("heading", { level: 3 })}
        title="Heading 3"
      >
        <Heading3 className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>

      <Divider />

      {/* Inline formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Bold"
      >
        <Bold className="w-3.5 h-3.5" strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italic"
      >
        <Italic className="w-3.5 h-3.5" strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        title="Underline"
      >
        <UnderlineIcon className="w-3.5 h-3.5" strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="Strikethrough"
      >
        <Strikethrough className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        title="Inline code"
      >
        <Code className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive("highlight")}
        title="Highlight"
      >
        <span className="w-3.5 h-3.5 flex items-center justify-center text-[10px] font-bold" style={{ color: design.colors.accent.gold }}>H</span>
      </ToolbarButton>

      <Divider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Bullet list"
      >
        <List className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="Numbered list"
      >
        <ListOrdered className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive("taskList")}
        title="Task list"
      >
        <ListChecks className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>

      <Divider />

      {/* Block elements */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title="Quote"
      >
        <Quote className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Divider"
      >
        <Minus className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>

      <Divider />

      {/* Text Alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        isActive={editor.isActive({ textAlign: "left" })}
        title="Align left"
      >
        <AlignLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        isActive={editor.isActive({ textAlign: "center" })}
        title="Align center"
      >
        <AlignCenter className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        isActive={editor.isActive({ textAlign: "right" })}
        title="Align right"
      >
        <AlignRight className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        isActive={editor.isActive({ textAlign: "justify" })}
        title="Justify"
      >
        <AlignJustify className="w-3.5 h-3.5" strokeWidth={1.5} />
      </ToolbarButton>

      <Divider />

      {/* Link */}
      <div className="relative">
        <ToolbarButton
          onClick={() => {
            if (editor.isActive("link")) {
              editor.chain().focus().unsetLink().run();
            } else {
              setShowLinkInput(!showLinkInput);
            }
          }}
          isActive={editor.isActive("link")}
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
                if (e.key === "Escape") { setShowLinkInput(false); setLinkUrl(""); }
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
            disabled={editor.state.selection.empty}
            title="AI Edit — select text first"
          >
            <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} style={{ color: design.colors.accent.gold }} />
          </ToolbarButton>
        </>
      )}
    </div>
  );
}
