"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAppStore } from "@/lib/store";

interface ExcalidrawEditorProps {
  readOnly?: boolean;
  initialData?: string;
}

export function ExcalidrawEditor({ readOnly = false, initialData }: ExcalidrawEditorProps) {
  const [Comp, setComp] = useState<any>(null);
  const diagramSource = useAppStore((s) => s.diagramSource);
  const updateDiagramSource = useAppStore((s) => s.updateDiagramSource);
  const excalidrawRef = useRef<any>(null);
  const isUpdatingRef = useRef(false);

  const source = initialData ?? diagramSource;

  useEffect(() => {
    const load = async () => {
      const mod = await import("@excalidraw/excalidraw");
      setComp(() => mod.Excalidraw);
    };
    load();
  }, []);

  const initialDataParsed = (() => {
    if (!source) return undefined;
    try {
      return JSON.parse(source);
    } catch {
      return undefined;
    }
  })();

  const handleChange = useCallback(
    (elements: any[], appState: any) => {
      if (readOnly || isUpdatingRef.current) return;
      // Debounce saves — only save meaningful elements
      const meaningful = elements.filter((e: any) => !e.isDeleted);
      if (meaningful.length === 0) return;
      const data = JSON.stringify({
        elements: meaningful,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
        },
      });
      updateDiagramSource(data);
    },
    [readOnly, updateDiagramSource]
  );

  if (!Comp) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[13px] text-[#95928E]">
          Loading whiteboard...
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full" style={{ backgroundColor: "#ffffff" }}>
      <Comp
        ref={excalidrawRef}
        initialData={initialDataParsed}
        onChange={readOnly ? undefined : handleChange}
        viewModeEnabled={readOnly}
        zenModeEnabled={false}
        gridModeEnabled={false}
        theme="light"
        UIOptions={{
          canvasActions: {
            loadScene: !readOnly,
            saveToActiveFile: false,
            export: { saveFileToDisk: !readOnly },
          },
        }}
      />
    </div>
  );
}

export function ExcalidrawReadOnly({ source }: { source: string }) {
  const [Comp, setComp] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const mod = await import("@excalidraw/excalidraw");
      setComp(() => mod.Excalidraw);
    };
    load();
  }, []);

  const initialData = (() => {
    if (!source) return undefined;
    try {
      return JSON.parse(source);
    } catch {
      return undefined;
    }
  })();

  if (!Comp) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[13px] text-[#95928E]">
          Loading whiteboard...
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full" style={{ backgroundColor: "#ffffff" }}>
      <Comp
        initialData={initialData}
        viewModeEnabled={true}
        zenModeEnabled={true}
        gridModeEnabled={false}
        theme="light"
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: { saveFileToDisk: false },
          },
        }}
      />
    </div>
  );
}
