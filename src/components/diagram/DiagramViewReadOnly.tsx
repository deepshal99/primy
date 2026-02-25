"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { design } from "@/lib/design";
import { ZoomPanWrapper } from "./ZoomPanWrapper";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const DEFAULT_COLORS = [
  "#8B5CF6", "#2DB67D", "#E5953E", "#3B82F6", "#EC4899",
  "#14B8A6", "#F59E0B", "#6366F1", "#EF4444", "#22D3EE",
];

interface DiagramViewReadOnlyProps {
  source: string;
  diagramType: "mermaid" | "chart";
}

export function DiagramViewReadOnly({ source, diagramType }: DiagramViewReadOnlyProps) {
  if (diagramType === "chart") {
    return <ChartRendererRO source={source} />;
  }
  return <MermaidRendererRO source={source} />;
}

function MermaidRendererRO({ source }: { source: string }) {
  const [svgHtml, setSvgHtml] = useState("");
  const [error, setError] = useState<string | null>(null);

  const render = useCallback(async () => {
    if (!source.trim()) return;
    try {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });
      const id = `mermaid-ro-${Date.now()}`;
      const { svg } = await mermaid.render(id, source.trim());
      setSvgHtml(svg);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Render error");
    }
  }, [source]);

  useEffect(() => { render(); }, [render]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <p className="text-[13px]" style={{ color: design.colors.status.error }}>{error}</p>
      </div>
    );
  }

  return (
    <ZoomPanWrapper>
      <div className="p-8" dangerouslySetInnerHTML={{ __html: svgHtml }} />
    </ZoomPanWrapper>
  );
}

function ChartRendererRO({ source }: { source: string }) {
  let config: any = null;
  try { config = JSON.parse(source); } catch { /* ignore */ }

  if (!config) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[13px]" style={{ color: design.colors.text.muted }}>Invalid chart data</p>
      </div>
    );
  }

  const { chartType = "bar", data = [], xKey = "name", yKeys = ["value"], colors = DEFAULT_COLORS, title } = config;

  const commonAxisProps = {
    tick: { fontSize: 12, fill: design.colors.text.secondary },
    axisLine: { stroke: design.colors.border.default },
    tickLine: { stroke: design.colors.border.default },
  };

  const renderChart = () => {
    switch (chartType) {
      case "bar":
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={design.colors.border.light} />
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
            <CartesianGrid strokeDasharray="3 3" stroke={design.colors.border.light} />
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
            <CartesianGrid strokeDasharray="3 3" stroke={design.colors.border.light} />
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
      default:
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={design.colors.border.light} />
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
      <div className="p-8 flex flex-col items-center">
        {title && (
          <h3 className="mb-4 text-[16px] font-semibold" style={{ color: design.colors.text.primary }}>
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
