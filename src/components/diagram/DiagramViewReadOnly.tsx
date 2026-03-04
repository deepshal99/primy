"use client";

import { useEffect, useState, useCallback } from "react";
import { ZoomPanWrapper } from "./ZoomPanWrapper";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import dynamic from "next/dynamic";

const ExcalidrawReadOnly = dynamic(
  () => import("./ExcalidrawEditor").then((m) => m.ExcalidrawReadOnly),
  { ssr: false }
);

const DEFAULT_COLORS = [
  "#6366F1", "#10B981", "#FF6B00", "#06B6D4", "#F59E0B",
  "#14B8A6", "#F59E0B", "#6366F1", "#EF4444", "#22D3EE",
];

const ReactFlowRendererLazy = dynamic(
  () => import("./ReactFlowRenderer").then((m) => m.ReactFlowRenderer),
  { ssr: false }
);

interface DiagramViewReadOnlyProps {
  source: string;
  diagramType: "mermaid" | "chart" | "excalidraw" | "reactflow";
}

export function DiagramViewReadOnly({ source, diagramType }: DiagramViewReadOnlyProps) {
  if (diagramType === "excalidraw") {
    return <ExcalidrawReadOnly source={source} />;
  }
  if (diagramType === "reactflow") {
    return <ReactFlowRendererLazy source={source} />;
  }
  if (diagramType === "chart") {
    return <ChartRendererRO source={source} />;
  }
  return <MermaidRendererRO source={source} />;
}

function MermaidRendererRO({ source }: { source: string }) {
  const [svgHtml, setSvgHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);

  const render = useCallback(async () => {
    if (!source.trim()) return;
    try {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });
      const id = `mermaid-ro-${Date.now()}`;
      const { svg } = await mermaid.render(id, source.trim());
      const responsiveSvg = svg
        .replace(/\bwidth="[^"]*"/, 'width="100%"')
        .replace(/\bheight="[^"]*"/, 'height="auto"');
      setSvgHtml(responsiveSvg);
      setError(null);
      requestAnimationFrame(() => setRendered(true));
    } catch (err: any) {
      setError(err?.message || "Render error");
    }
  }, [source]);

  useEffect(() => { render(); }, [render]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <p className="text-[13px] text-[#ef4444]">{error}</p>
      </div>
    );
  }

  return (
    <ZoomPanWrapper>
      <div
        className={`p-8 transition-opacity duration-300 ${rendered ? "opacity-100" : "opacity-0"}`}
        dangerouslySetInnerHTML={{ __html: svgHtml }}
      />
    </ZoomPanWrapper>
  );
}

function ChartRendererRO({ source }: { source: string }) {
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setRendered(true));
  }, []);

  let config: any = null;
  try { config = JSON.parse(source); } catch { /* ignore */ }

  if (!config) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[13px] text-[#95928E]">Invalid chart data</p>
      </div>
    );
  }

  const { chartType = "bar", data = [], xKey = "name", yKeys = ["value"], colors = DEFAULT_COLORS, title } = config;

  const commonAxisProps = {
    tick: { fontSize: 12, fill: "#6b6b80" },
    axisLine: { stroke: "#e8e7e4" },
    tickLine: { stroke: "#e8e7e4" },
  };

  const renderChart = () => {
    switch (chartType) {
      case "bar":
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e8ed" />
            <XAxis dataKey={xKey} {...commonAxisProps} />
            <YAxis {...commonAxisProps} />
            <Tooltip /><Legend />
            {yKeys.map((key: string, i: number) => (
              <Bar key={key} dataKey={key} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        );
      case "line":
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e8ed" />
            <XAxis dataKey={xKey} {...commonAxisProps} /><YAxis {...commonAxisProps} />
            <Tooltip /><Legend />
            {yKeys.map((key: string, i: number) => (
              <Line key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} strokeWidth={2} />
            ))}
          </LineChart>
        );
      case "area":
        return (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e8ed" />
            <XAxis dataKey={xKey} {...commonAxisProps} /><YAxis {...commonAxisProps} />
            <Tooltip /><Legend />
            {yKeys.map((key: string, i: number) => (
              <Area key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} fill={colors[i % colors.length]} fillOpacity={0.15} strokeWidth={2} />
            ))}
          </AreaChart>
        );
      case "pie":
        return (
          <PieChart>
            <Tooltip /><Legend />
            <Pie data={data} dataKey={yKeys[0] || "value"} nameKey={xKey} cx="50%" cy="50%" outerRadius={140} label>
              {data.map((_: any, i: number) => <Cell key={i} fill={colors[i % colors.length]} />)}
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
            <XAxis dataKey={xKey} {...commonAxisProps} /><YAxis {...commonAxisProps} />
            <Tooltip /><Legend />
            {yKeys.map((key: string, i: number) => (
              <Bar key={key} dataKey={key} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        );
    }
  };

  return (
    <ZoomPanWrapper>
      <div className={`p-8 flex flex-col items-center transition-opacity duration-300 ${rendered ? "opacity-100" : "opacity-0"}`}>
        {title && (
          <h3 className="mb-4 text-[16px] font-semibold text-[#1a1a2e]">
            {title}
          </h3>
        )}
        <div style={{ width: "768px", height: "400px" }}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </div>
    </ZoomPanWrapper>
  );
}
