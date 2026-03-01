"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  input:   { bg: "#e8f7ea", border: "#2e9e47", text: "#1a1a2e" },
  output:  { bg: "#fdf0ec", border: "#d4582a", text: "#1a1a2e" },
  default: { bg: "#e8f0fd", border: "#4a7aed", text: "#1a1a2e" },
  group:   { bg: "#f5f5fa", border: "#dddfe3", text: "#6b6b80" },
};

function getNodeStyle(type: string | undefined) {
  const colors = NODE_COLORS[type || "default"] || NODE_COLORS.default;
  return {
    background: colors.bg,
    border: `2px solid ${colors.border}`,
    borderRadius: "10px",
    padding: "10px 16px",
    fontSize: "13px",
    fontFamily: "Inter, system-ui, sans-serif",
    color: colors.text,
    fontWeight: 500,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
    minWidth: "120px",
    textAlign: "center" as const,
  };
}

const defaultEdgeOptions = {
  type: "smoothstep" as const,
  style: { stroke: "#6b6b80", strokeWidth: 2 },
  animated: false,
};

interface ReactFlowRendererProps {
  source: string;
}

export function ReactFlowRenderer({ source }: ReactFlowRendererProps) {
  const parsed = useMemo(() => {
    if (!source.trim()) {
      return { nodes: [] as Node[], edges: [] as Edge[], error: null as string | null };
    }
    try {
      const json = JSON.parse(source);
      const nodes: Node[] = (json.nodes || []).map((n: Node) => ({
        ...n,
        style: { ...getNodeStyle(n.type), ...n.style },
      }));
      const edges: Edge[] = (json.edges || []).map((e: Edge) => ({
        ...defaultEdgeOptions,
        ...e,
        style: { ...defaultEdgeOptions.style, ...e.style },
      }));
      return { nodes, edges, error: null as string | null };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid React Flow JSON";
      return { nodes: [] as Node[], edges: [] as Edge[], error: msg };
    }
  }, [source]);

  if (!source.trim()) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[13px] text-muted-foreground">
          No diagram source yet. Ask AI to create a diagram!
        </p>
      </div>
    );
  }

  if (parsed.error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
        <div className="flex flex-col items-center gap-2 text-center max-w-md">
          <div className="w-10 h-10 rounded-xl bg-[#d4183d]/10 flex items-center justify-center mb-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d4183d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="text-[14px] font-medium text-foreground">
            Couldn&apos;t render diagram
          </p>
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            The React Flow source has a JSON error. Try editing it or ask AI to fix it.
          </p>
        </div>
        <pre className="text-[11px] p-3 rounded-xl max-w-lg overflow-auto bg-muted text-muted-foreground border border-border">
          {parsed.error}
        </pre>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={parsed.nodes}
        edges={parsed.edges}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} color="#dddce0" />
        <Controls
          showInteractive={false}
          style={{ borderRadius: "8px", border: "1px solid #e8e8ed", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
        />
        <MiniMap
          nodeColor={(node) => {
            const colors = NODE_COLORS[node.type || "default"] || NODE_COLORS.default;
            return colors.border;
          }}
          maskColor="rgba(250, 250, 249, 0.7)"
          style={{ borderRadius: "8px", border: "1px solid #e8e8ed" }}
        />
      </ReactFlow>
    </div>
  );
}
