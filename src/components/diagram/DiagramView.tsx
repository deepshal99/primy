"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { design } from "@/lib/design";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const DEFAULT_COLORS = [
  "#8B5CF6", "#2DB67D", "#E5953E", "#3B82F6", "#EC4899",
  "#14B8A6", "#F59E0B", "#6366F1", "#EF4444", "#22D3EE",
];

export function DiagramView() {
  const diagramSource = useAppStore((s) => s.diagramSource);
  const diagramType = useAppStore((s) => s.diagramType);

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
        theme: "default",
        securityLevel: "loose",
        fontFamily: design.typography.family.sans,
      });

      const id = `mermaid-${Date.now()}`;
      const { svg } = await mermaid.render(id, source.trim());
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
        <p className="text-[13px]" style={{ color: design.colors.text.muted }}>
          No diagram source yet. Ask AI to create a diagram!
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-8">
        <p className="text-[13px] font-medium" style={{ color: design.colors.status.error }}>
          Diagram render error
        </p>
        <pre
          className="text-[11px] p-3 rounded-lg max-w-lg overflow-auto"
          style={{
            backgroundColor: design.colors.status.errorBg,
            color: design.colors.status.error,
          }}
        >
          {error}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full flex items-center justify-center overflow-auto p-8"
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
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
        <p className="text-[13px]" style={{ color: design.colors.text.muted }}>
          No chart data yet. Ask AI to create a chart!
        </p>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-8">
        <p className="text-[13px] font-medium" style={{ color: design.colors.status.error }}>
          Chart parse error
        </p>
        <pre
          className="text-[11px] p-3 rounded-lg max-w-lg overflow-auto"
          style={{
            backgroundColor: design.colors.status.errorBg,
            color: design.colors.status.error,
          }}
        >
          {error || "Could not parse chart configuration"}
        </pre>
      </div>
    );
  }

  const { chartType, data, xKey = "name", yKeys = ["value"], colors = DEFAULT_COLORS } = config;

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      {config.title && (
        <h3
          className="mb-4 text-[16px] font-semibold"
          style={{ color: design.colors.text.primary, fontFamily: design.typography.family.heading }}
        >
          {config.title}
        </h3>
      )}
      <div className="w-full max-w-3xl" style={{ height: "400px" }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(chartType, data, xKey, yKeys, colors)}
        </ResponsiveContainer>
      </div>
    </div>
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
    tick: { fontSize: 12, fill: design.colors.text.secondary },
    axisLine: { stroke: design.colors.border.default },
    tickLine: { stroke: design.colors.border.default },
  };

  switch (chartType) {
    case "bar":
      return (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={design.colors.border.light} />
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
          <CartesianGrid strokeDasharray="3 3" stroke={design.colors.border.light} />
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
          <CartesianGrid strokeDasharray="3 3" stroke={design.colors.border.light} />
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
          <CartesianGrid strokeDasharray="3 3" stroke={design.colors.border.light} />
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
          <CartesianGrid strokeDasharray="3 3" stroke={design.colors.border.light} />
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
