"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { ZoomPanWrapper } from "./ZoomPanWrapper";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { GitBranch, MessageSquare, PenTool } from "lucide-react";
import dynamic from "next/dynamic";

const ExcalidrawEditor = dynamic(
  () => import("./ExcalidrawEditor").then((m) => m.ExcalidrawEditor),
  { ssr: false }
);

const ReactFlowRenderer = dynamic(
  () => import("./ReactFlowRenderer").then((m) => m.ReactFlowRenderer),
  { ssr: false }
);

const DEFAULT_COLORS = [
  "#6366F1", "#10B981", "#FF6B00", "#06B6D4", "#F59E0B",
  "#14B8A6", "#F59E0B", "#6366F1", "#EF4444", "#22D3EE",
];

/** Replace pipe characters inside bracket-enclosed node labels with `/` */
function sanitizeMermaidSource(source: string): string {
  return source.replace(/(\[|\(|\{)([^\]\)\}]*?)(\]|\)|\})/g, (_, open, content, close) => {
    return open + content.replace(/\|/g, '/') + close;
  });
}

export function DiagramView() {
  const diagramSource = useAppStore((s) => s.diagramSource);
  const diagramType = useAppStore((s) => s.diagramType);

  if (diagramType === "excalidraw") {
    return <ExcalidrawEditor />;
  }

  if (diagramType === "reactflow") {
    return <ReactFlowRenderer source={diagramSource} />;
  }

  if (diagramType === "chart") {
    return <ChartRenderer source={diagramSource} />;
  }

  return <MermaidRenderer source={diagramSource} />;
}

// ═══ Mermaid Renderer ═══

function MermaidRenderer({ source }: { source: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svgHtml, setSvgHtml] = useState<string>("");

  const renderMermaid = useCallback(async () => {
    if (!source.trim()) {
      setSvgHtml("");
      setError(null);
      return;
    }

    try {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        securityLevel: "loose",
        fontFamily: "Inter, system-ui, sans-serif",
        themeVariables: {
          // Base colors
          primaryColor: "#e8f0fd",
          primaryTextColor: "#1a1a2e",
          primaryBorderColor: "#4a7aed",
          secondaryColor: "#f3eefb",
          secondaryTextColor: "#1a1a2e",
          secondaryBorderColor: "#7c5cb8",
          tertiaryColor: "#e8f7ea",
          tertiaryTextColor: "#1a1a2e",
          tertiaryBorderColor: "#2e9e47",

          // Lines & edges
          lineColor: "#6b6b80",

          // Text
          textColor: "#1a1a2e",

          // Flowchart
          nodeBorder: "#4a7aed",
          mainBkg: "#e8f0fd",
          nodeBkg: "#e8f0fd",
          clusterBkg: "#f5f5fa",
          clusterBorder: "#dddfe3",
          edgeLabelBackground: "#ffffff",

          // Sequence
          actorBkg: "#e8f0fd",
          actorBorder: "#4a7aed",
          actorTextColor: "#1a1a2e",
          actorLineColor: "#6b6b80",
          signalColor: "#1a1a2e",
          signalTextColor: "#1a1a2e",
          noteBkgColor: "#fef9e8",
          noteBorderColor: "#d4a500",
          noteTextColor: "#1a1a2e",
          activationBkgColor: "#e8f0fd",
          activationBorderColor: "#4a7aed",
          sequenceNumberColor: "#ffffff",

          // State
          labelColor: "#1a1a2e",
          altBackground: "#f5f5fa",

          // ER
          entityBkg: "#ffffff",
          entityBorder: "#4a7aed",

          // Pie
          pie1: "#4a7aed",
          pie2: "#2e9e47",
          pie3: "#7c5cb8",
          pie4: "#d4582a",
          pie5: "#06B6D4",
          pie6: "#d4a500",
          pie7: "#e8627c",

          // Fonts
          fontSize: "14px",
        },
        themeCSS: `
          /* ── Global ── */
          .label, .nodeLabel, .edgeLabel, text {
            font-family: Inter, system-ui, sans-serif !important;
            fill: #1a1a2e;
          }
          .edgeLabel {
            background-color: #ffffff;
            padding: 2px 6px;
            border-radius: 4px;
          }

          /* ── Flowchart Nodes ── */
          .node rect, .node polygon, .node circle, .node ellipse {
            stroke-width: 2px;
            rx: 8;
            ry: 8;
            filter: drop-shadow(0 1px 2px rgba(0,0,0,0.06));
          }
          .node:nth-child(5n+1) rect, .node:nth-child(5n+1) polygon { fill: #e8f0fd; stroke: #4a7aed; }
          .node:nth-child(5n+2) rect, .node:nth-child(5n+2) polygon { fill: #e8f7ea; stroke: #2e9e47; }
          .node:nth-child(5n+3) rect, .node:nth-child(5n+3) polygon { fill: #f3eefb; stroke: #7c5cb8; }
          .node:nth-child(5n+4) rect, .node:nth-child(5n+4) polygon { fill: #fdf0ec; stroke: #d4582a; }
          .node:nth-child(5n+5) rect, .node:nth-child(5n+5) polygon { fill: #e6fafb; stroke: #06B6D4; }

          /* ── Flowchart Edges ── */
          .flowchart-link { stroke-width: 2px !important; }
          marker path { fill: #6b6b80; }

          /* ── Clusters / Subgraphs ── */
          .cluster rect {
            fill: #f9f9fb !important;
            stroke: #e8e7e4 !important;
            stroke-width: 1.5px;
            rx: 10;
            ry: 10;
          }
          .cluster span, .cluster text { fill: #6b6b80 !important; font-weight: 600; font-size: 13px; }

          /* ── Sequence Diagram ── */
          .actor {
            fill: #e8f0fd;
            stroke: #4a7aed;
            stroke-width: 2px;
            rx: 8;
            ry: 8;
          }
          .actor-man circle, .actor-man line { stroke: #4a7aed; stroke-width: 2px; }
          text.actor > tspan { font-weight: 600; font-size: 13px; }
          .messageLine0, .messageLine1 { stroke-width: 1.5px; stroke: #6b6b80; }
          .messageText { font-size: 13px; fill: #1a1a2e; }
          .note { fill: #fef9e8; stroke: #d4a500; stroke-width: 1.5px; rx: 6; ry: 6; }
          .noteText { font-size: 12px; }
          .activation0, .activation1, .activation2 {
            fill: #e8f0fd;
            stroke: #4a7aed;
            stroke-width: 1.5px;
          }
          .loopText tspan { font-size: 12px; font-weight: 600; fill: #6b6b80; }
          .loopLine { stroke: #dddfe3; stroke-width: 1.5px; }
          .labelBox { fill: #f5f5fa; stroke: #dddfe3; rx: 4; ry: 4; }

          /* ── Class Diagram ── */
          g.classGroup rect {
            fill: #e8f0fd;
            stroke: #4a7aed;
            stroke-width: 2px;
            rx: 8;
            ry: 8;
          }
          g.classGroup line { stroke: #dddfe3; stroke-width: 1px; }
          g.classGroup text { font-size: 13px; fill: #1a1a2e; }
          .classLabel .box { fill: #4a7aed; stroke: none; rx: 8; ry: 8; opacity: 1; }
          .classLabel .label { fill: #ffffff; font-weight: 600; font-size: 13px; }
          .relation { stroke: #6b6b80; stroke-width: 1.5px; }

          /* ── State Diagram ── */
          g.stateGroup rect {
            fill: #e8f0fd;
            stroke: #4a7aed;
            stroke-width: 2px;
            rx: 10;
            ry: 10;
          }
          g.stateGroup text { font-size: 13px; fill: #1a1a2e; }
          .stateGroup .composit { fill: #f9f9fb; }
          .statediagram-state rect.divider { stroke: #e8e7e4; }
          .node circle.start-state { fill: #4a7aed; stroke: #4a7aed; }
          .node circle.end-state-outer { fill: transparent; stroke: #4a7aed; stroke-width: 2px; }
          .node circle.end-state-inner { fill: #4a7aed; }
          .transition { stroke: #6b6b80; stroke-width: 1.5px; }

          /* ── ER Diagram ── */
          .er.entityBox {
            fill: #ffffff;
            stroke: #4a7aed;
            stroke-width: 2px;
            rx: 8;
            ry: 8;
          }
          .er.entityLabel { font-weight: 600; font-size: 13px; fill: #1a1a2e; }
          .er.attributeBoxEven { fill: #f9f9fb; }
          .er.attributeBoxOdd { fill: #ffffff; }
          .er.relationshipLine { stroke: #6b6b80; stroke-width: 1.5px; }
          .er.relationshipLabel { font-size: 12px; fill: #6b6b80; }

          /* ── Mindmap ── */
          .mindmap-node rect, .mindmap-node circle, .mindmap-node polygon {
            stroke-width: 2px;
            rx: 8;
            ry: 8;
          }
          .section-root-0 > rect, .section-root-0 > circle { fill: #e8f0fd !important; stroke: #4a7aed !important; }
          .section-root-1 > rect, .section-root-1 > circle { fill: #e8f7ea !important; stroke: #2e9e47 !important; }
          .section-root-2 > rect, .section-root-2 > circle { fill: #f3eefb !important; stroke: #7c5cb8 !important; }
          .section-root-3 > rect, .section-root-3 > circle { fill: #fdf0ec !important; stroke: #d4582a !important; }
          .section-root-4 > rect, .section-root-4 > circle { fill: #e6fafb !important; stroke: #06B6D4 !important; }

          /* ── Pie Chart ── */
          .pieCircle { stroke: #ffffff; stroke-width: 2px; }
          .pieTitleText { font-size: 16px; font-weight: 600; fill: #1a1a2e; }
          .slice { font-size: 13px; fill: #1a1a2e; }
          .legend text { font-size: 13px; fill: #1a1a2e; }

          /* ── Git Graph ── */
          .commit-id, .commit-msg { font-size: 12px; fill: #6b6b80; }
          .branch-label { font-size: 13px; font-weight: 600; }

          /* ── Journey ── */
          .task { rx: 6; ry: 6; }
          .task-text { font-size: 13px; }

          /* ── General polish ── */
          .titleText { font-size: 18px; font-weight: 600; fill: #1a1a2e; }
          .arrowheadPath { fill: #6b6b80; }
        `,
      });

      const id = `mermaid-${Date.now()}`;
      const sanitized = sanitizeMermaidSource(source.trim());
      const { svg } = await mermaid.render(id, sanitized);
      setSvgHtml(svg);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to render diagram");
      setSvgHtml("");
    }
  }, [source]);

  useEffect(() => {
    renderMermaid();
  }, [renderMermaid]);

  if (!source.trim()) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center px-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#e6fafb]">
            <GitBranch className="w-5 h-5 text-[#06B6D4]" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[13px] font-medium mb-1.5 text-[#95928E]">
              No diagram yet
            </p>
            <div className="flex items-center justify-center gap-4 text-[11px] text-[#b0ada6]">
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                Describe it in chat
              </span>
              <span className="text-[#d0cfc9]">/</span>
              <span className="flex items-center gap-1">
                <PenTool className="w-3 h-3" />
                Draw with Excalidraw
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    // Strip mermaid version noise from error message
    const cleanError = error
      .replace(/mermaid version [\d.]+/gi, "")
      .replace(/Syntax error in text\s*/i, "Syntax error in diagram source")
      .trim();
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
            The diagram source has a syntax error. Try editing it or ask AI to fix it.
          </p>
        </div>
        <pre className="text-[11px] p-3 rounded-xl max-w-lg overflow-auto bg-muted text-muted-foreground border border-border">
          {cleanError || error}
        </pre>
      </div>
    );
  }

  return (
    <ZoomPanWrapper>
      <div
        ref={containerRef}
        className="p-8 animate-in fade-in duration-300"
        dangerouslySetInnerHTML={{ __html: svgHtml }}
      />
    </ZoomPanWrapper>
  );
}

// ═══ Recharts Renderer ═══

interface ChartConfig {
  chartType: string;
  data: any[];
  xKey?: string;
  yKeys?: string[];
  colors?: string[];
  title?: string;
}

function ChartRenderer({ source }: { source: string }) {
  const [config, setConfig] = useState<ChartConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!source.trim()) {
      setConfig(null);
      setError(null);
      return;
    }
    try {
      const parsed = JSON.parse(source);
      setConfig(parsed);
      setError(null);
    } catch {
      setError("Invalid chart JSON");
    }
  }, [source]);

  if (!source.trim()) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center px-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#e6fafb]">
            <GitBranch className="w-5 h-5 text-[#06B6D4]" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[13px] font-medium mb-1 text-[#95928E]">
              No chart data yet
            </p>
            <p className="text-[11px] text-[#b0ada6]">
              Ask AI to create a chart from your data
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-8">
        <p className="text-[13px] font-medium text-red-600">
          Chart parse error
        </p>
        <pre className="text-[11px] p-3 rounded-lg max-w-lg overflow-auto bg-red-50 text-red-600 border border-red-100">
          {error || "Could not parse chart configuration"}
        </pre>
      </div>
    );
  }

  const { chartType, data, xKey = "name", yKeys = ["value"], colors = DEFAULT_COLORS } = config;

  return (
    <ZoomPanWrapper>
      <div className="p-8 flex flex-col items-center animate-in fade-in duration-300">
        {config.title && (
          <h3 className="mb-4 text-[16px] font-semibold text-foreground">
            {config.title}
          </h3>
        )}
        <div style={{ width: "768px", height: "400px" }}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart(chartType, data, xKey, yKeys, colors)}
          </ResponsiveContainer>
        </div>
      </div>
    </ZoomPanWrapper>
  );
}

function renderChart(
  chartType: string,
  data: any[],
  xKey: string,
  yKeys: string[],
  colors: string[]
): React.ReactElement {
  const commonAxisProps = {
    tick: { fontSize: 12, fill: "#6b6b80" },
    axisLine: { stroke: "#e8e7e4" },
    tickLine: { stroke: "#e8e7e4" },
  };

  switch (chartType) {
    case "bar":
      return (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e8ed" />
          <XAxis dataKey={xKey} {...commonAxisProps} />
          <YAxis {...commonAxisProps} />
          <Tooltip />
          <Legend />
          {yKeys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      );

    case "line":
      return (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e8ed" />
          <XAxis dataKey={xKey} {...commonAxisProps} />
          <YAxis {...commonAxisProps} />
          <Tooltip />
          <Legend />
          {yKeys.map((key, i) => (
            <Line key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ r: 4 }} />
          ))}
        </LineChart>
      );

    case "area":
      return (
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e8ed" />
          <XAxis dataKey={xKey} {...commonAxisProps} />
          <YAxis {...commonAxisProps} />
          <Tooltip />
          <Legend />
          {yKeys.map((key, i) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[i % colors.length]}
              fill={colors[i % colors.length]}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      );

    case "pie":
      return (
        <PieChart>
          <Tooltip />
          <Legend />
          <Pie
            data={data}
            dataKey={yKeys[0] || "value"}
            nameKey={xKey}
            cx="50%"
            cy="50%"
            outerRadius={140}
            label
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
        </PieChart>
      );

    case "scatter":
      return (
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e8ed" />
          <XAxis dataKey={xKey} {...commonAxisProps} name={xKey} />
          <YAxis dataKey={yKeys[0]} {...commonAxisProps} name={yKeys[0]} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          <Legend />
          <Scatter data={data} fill={colors[0]} />
        </ScatterChart>
      );

    default:
      return (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8e8ed" />
          <XAxis dataKey={xKey} {...commonAxisProps} />
          <YAxis {...commonAxisProps} />
          <Tooltip />
          <Legend />
          {yKeys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      );
  }
}
