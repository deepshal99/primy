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
import remarkGfm from "remark-gfm";
import { TablePlugin } from "@platejs/table/react";
import { ImagePlugin } from "@platejs/media/react";
import { parseEntityUri } from "@/lib/entityLinks";

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
  key: "hr",
  node: {
    isElement: true,
    isVoid: true,
    component: HrElement,
  },
});

// Read-only image — plain render, no resize/align controls.
function ImageElement({ attributes, children, element }: any) {
  const align: "left" | "center" | "right" = element.align || "center";
  const justifyClass =
    align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  return (
    <div {...attributes} contentEditable={false} className={`my-4 flex ${justifyClass}`}>
      <img
        src={element.url}
        alt={element.caption || ""}
        className="rounded-lg border border-border"
        style={{
          maxHeight: 500,
          width: element.width ? `${element.width}px` : undefined,
          maxWidth: "100%",
        }}
        draggable={false}
      />
      {children}
    </div>
  );
}

// Read-only table elements — no add row/column affordances.
function TableElement({ attributes, children }: any) {
  return (
    <div {...attributes} className="my-4">
      <table className="doc-editor w-full border-collapse">
        <tbody>{children}</tbody>
      </table>
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

// Read-only mention — styled, non-interactive text (targets aren't public).
function MentionElement({ attributes, children, element }: any) {
  return (
    <span
      {...attributes}
      contentEditable={false}
      className="text-[#4285F4] font-medium"
    >
      @{element.value || ""}
      {children}
    </span>
  );
}

// Convert any link node whose url is drafta:// into a mention node, recursively.
function hydrateMentions(nodes: any[]): any[] {
  if (!Array.isArray(nodes)) return nodes;
  return nodes.map((n) => {
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
      MarkdownPlugin.configure({
        options: {
          remarkPlugins: [remarkGfm],
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
      if (!content) return [{ type: "p", children: [{ text: "" }] }];
      return mdToValue(editor, content);
    },
  });

  // Update editor value when content changes
  useMemo(() => {
    if (editor && content) {
      try {
        editor.tf.setValue(mdToValue(editor, content));
      } catch {
        // ignore
      }
    }
  }, [content, editor]);

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-1 overflow-y-auto">
        <Plate editor={editor} readOnly>
          <PlateContent
            className="doc-editor focus:outline-none px-12 py-10 min-h-full max-w-[800px] mx-auto"
            style={{ lineHeight: "1.8" }}
          />
        </Plate>
      </div>
    </div>
  );
}
