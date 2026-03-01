"use client";

import { useMemo } from "react";
import { Plate, PlateContent, usePlateEditor, createPlatePlugin } from "platejs/react";
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

// HR void element plugin — prevents React from passing children to <hr>
function HrElement({ attributes, children }: any) {
  return (
    <div {...attributes} contentEditable={false}>
      <hr className="my-4 border-t border-border" />
      {children}
    </div>
  );
}

const HrPlugin = createPlatePlugin({
  key: 'hr',
  node: {
    isElement: true,
    isVoid: true,
    component: HrElement,
  },
});

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
      HrPlugin,
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
      className="h-full flex flex-col bg-background"
    >
      <div className="flex-1 overflow-y-auto">
        <Plate editor={editor} readOnly>
          <PlateContent className="doc-editor focus:outline-none px-8 py-6 min-h-full" />
        </Plate>
      </div>
    </div>
  );
}
