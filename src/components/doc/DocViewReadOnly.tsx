"use client";

import { useMemo } from "react";
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
import { MarkdownPlugin } from "@platejs/markdown";
import { design } from "@/lib/design";

interface DocViewReadOnlyProps {
  content: string;
}

export function DocViewReadOnly({ content }: DocViewReadOnlyProps) {
  const plugins = useMemo(
    () => [
      BasicBlocksPlugin,
      BasicMarksPlugin,
      HighlightPlugin,
      CodeBlockPlugin,
      ListPlugin,
      LinkPlugin.configure({
        options: {
          defaultLinkAttributes: { target: "_blank", rel: "noopener" },
        },
      }),
      TextAlignPlugin,
      MarkdownPlugin,
    ],
    []
  );

  const editor = usePlateEditor({
    plugins,
    value: (editor) => {
      if (!content) return [{ type: "p", children: [{ text: "" }] }];
      try {
        return editor.getApi(MarkdownPlugin).markdown.deserialize(content);
      } catch {
        return [{ type: "p", children: [{ text: content }] }];
      }
    },
  });

  // Update editor value when content changes
  useMemo(() => {
    if (editor && content) {
      try {
        const val = editor.getApi(MarkdownPlugin).markdown.deserialize(content);
        editor.tf.setValue(val);
      } catch {
        // ignore
      }
    }
  }, [content, editor]);

  return (
    <div
      className="h-full flex flex-col"
      style={{ backgroundColor: design.colors.bg.primary }}
    >
      <div className="flex-1 overflow-y-auto">
        <Plate editor={editor} readOnly>
          <PlateContent className="doc-editor focus:outline-none px-8 py-6 min-h-full" />
        </Plate>
      </div>
    </div>
  );
}
