"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import LinkExt from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { Markdown } from "tiptap-markdown";
import { useEffect } from "react";
import { design } from "@/lib/design";

interface DocViewReadOnlyProps {
  content: string;
}

export function DocViewReadOnly({ content }: DocViewReadOnlyProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        codeBlock: {
          HTMLAttributes: { class: "doc-code-block" },
        },
      }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      LinkExt.configure({
        openOnClick: true,
        HTMLAttributes: { class: "doc-link", target: "_blank", rel: "noopener" },
      }),
      Highlight.configure({ multicolor: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Markdown,
    ],
    content: content || "",
    editorProps: {
      attributes: {
        class: "doc-editor focus:outline-none px-8 py-6 min-h-full",
      },
    },
  });

  useEffect(() => {
    if (editor && content) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: design.colors.bg.primary }}>
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
