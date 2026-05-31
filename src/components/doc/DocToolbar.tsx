"use client";

import { useRef } from "react";
import type { PlateEditor } from "platejs/react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Quote,
  Minus,
  SquareCode,
  Link,
  ImagePlus,
  Table,
} from "lucide-react";
import { cn } from "@/lib/cn";

const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
const modKey = isMac ? "\u2318" : "Ctrl";

const SHORTCUT_MAP: Record<string, string> = {
  bold: `${modKey}+B`,
  italic: `${modKey}+I`,
  underline: `${modKey}+U`,
  code: `${modKey}+E`,
  highlight: `${modKey}+Shift+H`,
};

interface ToolbarItem {
  icon: React.ElementType;
  command: string;
  value?: string;
  label: string;
}

const TOOLBAR_GROUPS: { label: string; buttons: ToolbarItem[] }[] = [
  {
    label: "Text Style",
    buttons: [
      { icon: Bold, command: "bold", label: "Bold" },
      { icon: Italic, command: "italic", label: "Italic" },
      { icon: UnderlineIcon, command: "underline", label: "Underline" },
      { icon: Strikethrough, command: "strikethrough", label: "Strikethrough" },
      { icon: Code, command: "code", label: "Inline Code" },
      { icon: Highlighter, command: "highlight", label: "Highlight" },
    ],
  },
  {
    label: "Headings",
    buttons: [
      { icon: Heading1, command: "heading", value: "h1", label: "Heading 1" },
      { icon: Heading2, command: "heading", value: "h2", label: "Heading 2" },
      { icon: Heading3, command: "heading", value: "h3", label: "Heading 3" },
      { icon: Type, command: "heading", value: "p", label: "Paragraph" },
    ],
  },
  {
    label: "Alignment",
    buttons: [
      { icon: AlignLeft, command: "align", value: "left", label: "Align Left" },
      { icon: AlignCenter, command: "align", value: "center", label: "Align Center" },
      { icon: AlignRight, command: "align", value: "right", label: "Align Right" },
    ],
  },
  {
    label: "Lists & Blocks",
    buttons: [
      { icon: List, command: "list", value: "ul", label: "Bullet List" },
      { icon: ListOrdered, command: "list", value: "ol", label: "Numbered List" },
      { icon: Quote, command: "block", value: "blockquote", label: "Quote" },
      { icon: SquareCode, command: "codeblock", label: "Code Block" },
      { icon: Minus, command: "hr", label: "Divider" },
    ],
  },
  {
    label: "Insert",
    buttons: [
      { icon: Link, command: "link", label: "Link" },
      { icon: ImagePlus, command: "image", label: "Image" },
      { icon: Table, command: "table", label: "Table" },
    ],
  },
];

interface DocToolbarProps {
  editor: PlateEditor | null;
}

export function DocToolbar({ editor }: DocToolbarProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);

  if (!editor) return null;

  const isMark = (mark: string) => {
    try {
      const marks = (editor as any).getMarks?.() ?? editor.marks;
      return marks ? !!(marks as any)[mark] : false;
    } catch {
      return false;
    }
  };

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

  const execCommand = (btn: ToolbarItem) => {
    switch (btn.command) {
      case "bold":
      case "italic":
      case "underline":
      case "strikethrough":
      case "code":
      case "highlight":
        editor.tf.toggleMark(btn.command);
        break;
      case "heading":
        editor.tf.toggleBlock(btn.value!);
        break;
      case "align":
        editor.tf.setNodes({ textAlign: btn.value } as any, {
          match: (n: any) => editor.api.isBlock(n),
        });
        break;
      case "list":
        editor.tf.toggleBlock(btn.value!);
        break;
      case "block":
        editor.tf.toggleBlock(btn.value!);
        break;
      case "codeblock":
        editor.tf.toggleBlock("code_block");
        break;
      case "hr":
        editor.tf.insertNodes({ type: "hr", children: [{ text: "" }] } as any);
        break;
      case "link": {
        const url = window.prompt("Enter URL:");
        if (url) {
          editor.tf.wrapNodes(
            { type: "a", url, children: [] } as any,
            { split: true }
          );
        }
        break;
      }
      case "image": {
        // Open file picker — reads as data URL for local images
        imageInputRef.current?.click();
        break;
      }
      case "table": {
        editor.tf.insertNodes({
          type: "table",
          children: [
            {
              type: "tr",
              children: [
                { type: "th", children: [{ type: "p", children: [{ text: "Header 1" }] }] },
                { type: "th", children: [{ type: "p", children: [{ text: "Header 2" }] }] },
                { type: "th", children: [{ type: "p", children: [{ text: "Header 3" }] }] },
              ],
            },
            {
              type: "tr",
              children: [
                { type: "td", children: [{ type: "p", children: [{ text: "" }] }] },
                { type: "td", children: [{ type: "p", children: [{ text: "" }] }] },
                { type: "td", children: [{ type: "p", children: [{ text: "" }] }] },
              ],
            },
            {
              type: "tr",
              children: [
                { type: "td", children: [{ type: "p", children: [{ text: "" }] }] },
                { type: "td", children: [{ type: "p", children: [{ text: "" }] }] },
                { type: "td", children: [{ type: "p", children: [{ text: "" }] }] },
              ],
            },
          ],
        } as any);
        break;
      }
    }
  };

  const isActive = (btn: ToolbarItem): boolean => {
    switch (btn.command) {
      case "bold":
      case "italic":
      case "underline":
      case "strikethrough":
      case "code":
      case "highlight":
        return isMark(btn.command);
      case "heading":
      case "list":
      case "block":
        return isBlock(btn.value!);
      case "codeblock":
        return isBlock("code_block");
      default:
        return false;
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      editor.tf.insertNodes({
        type: "img",
        url,
        children: [{ text: "" }],
      } as any);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex items-center gap-0.5 px-4 py-2 border-b border-border overflow-x-auto flex-wrap">
      {TOOLBAR_GROUPS.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && <div className="w-px h-5 bg-border mx-1.5" />}
          {group.buttons.map((btn, bi) => {
            const active = isActive(btn);
            const shortcut = SHORTCUT_MAP[btn.command];
            const title = shortcut ? `${btn.label} (${shortcut})` : btn.label;

            return (
              <button
                key={bi}
                onClick={() => execCommand(btn)}
                title={title}
                className={cn(
                  "w-8 h-8 flex items-center justify-center rounded-md t-fast active:scale-[0.95]",
                  active
                    ? "bg-muted text-foreground shadow-[0_0_0_1px_rgba(255,180,63,0.15),0_0_6px_rgba(255,180,63,0.08)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted hover:shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_0_8px_rgba(0,0,0,0.03)]"
                )}
              >
                <btn.icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      ))}

      {/* Hidden image file input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
    </div>
  );
}
