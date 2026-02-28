"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { design } from "@/lib/design";
import { FileText, Table2, GitBranch, Presentation, FolderOpen, Loader2, AlertCircle, Pen, ExternalLink } from "lucide-react";
import dynamic from "next/dynamic";

const DocViewReadOnly = dynamic(
  () => import("@/components/doc/DocViewReadOnly").then((m) => m.DocViewReadOnly),
  { ssr: false }
);
const SheetViewReadOnly = dynamic(
  () => import("@/components/sheet/SheetViewReadOnly").then((m) => m.SheetViewReadOnly),
  { ssr: false }
);
const DiagramViewReadOnly = dynamic(
  () => import("@/components/diagram/DiagramViewReadOnly").then((m) => m.DiagramViewReadOnly),
  { ssr: false }
);
const DeckViewReadOnly = dynamic(
  () => import("@/components/deck/DeckViewReadOnly").then((m) => m.DeckViewReadOnly),
  { ssr: false }
);

type ShareData =
  | { type: "document"; title: string; content: string; projectTitle: string }
  | { type: "table"; title: string; sheets: any[]; projectTitle: string }
  | { type: "diagram"; title: string; diagramType: "mermaid" | "chart" | "excalidraw"; source: string; projectTitle: string }
  | { type: "deck"; title: string; slides: any[]; theme: string; projectTitle: string }
  | { type: "project"; title: string; description?: string; documents: any[]; tables: any[]; diagrams?: any[]; decks?: any[] };

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // For project view: which file is selected
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"document" | "table" | "diagram" | "deck" | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/share/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((d) => {
        setData(d);
        // Auto-select first file for project view
        if (d.type === "project") {
          if (d.documents?.length > 0) {
            setSelectedId(d.documents[0].id);
            setSelectedType("document");
          } else if (d.tables?.length > 0) {
            setSelectedId(d.tables[0].id);
            setSelectedType("table");
          } else if (d.diagrams?.length > 0) {
            setSelectedId(d.diagrams[0].id);
            setSelectedType("diagram");
          } else if (d.decks?.length > 0) {
            setSelectedId(d.decks[0].id);
            setSelectedType("deck");
          }
        }
      })
      .catch(() => setError("This shared link is no longer available or doesn't exist."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: design.colors.bg.primary }}>
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: design.colors.brand.primary }} />
          <span className="text-[14px]" style={{ color: design.colors.text.secondary }}>Loading...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: design.colors.bg.primary }}>
        <div className="flex flex-col items-center gap-4 text-center px-8 max-w-md">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: design.colors.status.errorBg }}
          >
            <AlertCircle className="w-7 h-7" style={{ color: design.colors.status.error }} />
          </div>
          <div>
            <p className="text-[16px] font-semibold mb-1" style={{ color: design.colors.text.primary }}>
              Link not found
            </p>
            <p className="text-[13px]" style={{ color: design.colors.text.secondary }}>
              {error || "This shared link is no longer available."}
            </p>
          </div>
          <a
            href="/"
            className="text-[13px] font-medium px-4 py-2 rounded-lg transition-colors"
            style={{ color: design.colors.brand.primary, backgroundColor: design.colors.brand.subtle }}
          >
            Go to Drafta
          </a>
        </div>
      </div>
    );
  }

  // Single document
  if (data.type === "document") {
    return (
      <div className="h-screen flex flex-col" style={{ backgroundColor: design.colors.bg.primary }}>
        <ShareHeader title={data.title} subtitle={data.projectTitle} icon={<FileText className="w-4 h-4" style={{ color: design.colors.entity.doc }} />} />
        <div className="flex-1 overflow-hidden">
          <DocViewReadOnly content={data.content} />
        </div>
      </div>
    );
  }

  // Single table
  if (data.type === "table") {
    return (
      <div className="h-screen flex flex-col" style={{ backgroundColor: design.colors.bg.primary }}>
        <ShareHeader title={data.title} subtitle={data.projectTitle} icon={<Table2 className="w-4 h-4" style={{ color: design.colors.entity.sheet }} />} />
        <div className="flex-1 overflow-hidden">
          <SheetViewReadOnly sheets={data.sheets || []} />
        </div>
      </div>
    );
  }

  // Single diagram
  if (data.type === "diagram") {
    return (
      <div className="h-screen flex flex-col" style={{ backgroundColor: design.colors.bg.primary }}>
        <ShareHeader title={data.title} subtitle={data.projectTitle} icon={<GitBranch className="w-4 h-4" style={{ color: design.colors.entity.diagram }} />} />
        <div className="flex-1 overflow-hidden">
          <DiagramViewReadOnly source={data.source} diagramType={data.diagramType} />
        </div>
      </div>
    );
  }

  // Single deck
  if (data.type === "deck") {
    return (
      <div className="h-screen flex flex-col" style={{ backgroundColor: design.colors.bg.primary }}>
        <ShareHeader title={data.title} subtitle={data.projectTitle} icon={<Presentation className="w-4 h-4" style={{ color: design.colors.entity.deck }} />} />
        <div className="flex-1 overflow-hidden">
          <DeckViewReadOnly slides={data.slides} theme={data.theme} />
        </div>
      </div>
    );
  }

  // Project view
  const selectedDoc = data.documents?.find((d: any) => d.id === selectedId);
  const selectedTable = data.tables?.find((t: any) => t.id === selectedId);
  const selectedDiagram = data.diagrams?.find((d: any) => d.id === selectedId);
  const selectedDeck = data.decks?.find((d: any) => d.id === selectedId);

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: design.colors.bg.primary }}>
      <ShareHeader
        title={data.title}
        subtitle={data.description || "Shared project"}
        icon={<FolderOpen className="w-4 h-4" style={{ color: design.colors.brand.primary }} />}
      />
      <div className="flex-1 flex overflow-hidden">
        {/* File sidebar */}
        <div
          className="w-[220px] flex-shrink-0 border-r overflow-y-auto"
          style={{ borderColor: design.colors.border.default, backgroundColor: design.colors.bg.secondary }}
        >
          <div className="p-3">
            {data.documents?.length > 0 && (
              <div className="mb-3">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 px-2"
                  style={{ color: design.colors.text.muted, letterSpacing: design.typography.letterSpacing.widest }}
                >
                  Documents
                </p>
                {data.documents.map((doc: any) => (
                  <button
                    key={doc.id}
                    onClick={() => { setSelectedId(doc.id); setSelectedType("document"); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] transition-colors text-left"
                    style={{
                      backgroundColor: selectedId === doc.id ? design.colors.bg.elevated : "transparent",
                      color: selectedId === doc.id ? design.colors.text.primary : design.colors.text.secondary,
                      fontWeight: selectedId === doc.id ? 500 : 400,
                      boxShadow: selectedId === doc.id ? design.shadows.sm : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedId !== doc.id) e.currentTarget.style.backgroundColor = design.colors.bg.hover;
                    }}
                    onMouseLeave={(e) => {
                      if (selectedId !== doc.id) e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <FileText className="w-3.5 h-3.5 flex-shrink-0" style={{ color: design.colors.entity.doc }} strokeWidth={1.8} />
                    <span className="truncate">{doc.title}</span>
                  </button>
                ))}
              </div>
            )}
            {data.tables?.length > 0 && (
              <div className="mb-3">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 px-2"
                  style={{ color: design.colors.text.muted, letterSpacing: design.typography.letterSpacing.widest }}
                >
                  Tables
                </p>
                {data.tables.map((table: any) => (
                  <button
                    key={table.id}
                    onClick={() => { setSelectedId(table.id); setSelectedType("table"); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] transition-colors text-left"
                    style={{
                      backgroundColor: selectedId === table.id ? design.colors.bg.elevated : "transparent",
                      color: selectedId === table.id ? design.colors.text.primary : design.colors.text.secondary,
                      fontWeight: selectedId === table.id ? 500 : 400,
                      boxShadow: selectedId === table.id ? design.shadows.sm : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedId !== table.id) e.currentTarget.style.backgroundColor = design.colors.bg.hover;
                    }}
                    onMouseLeave={(e) => {
                      if (selectedId !== table.id) e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <Table2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: design.colors.entity.sheet }} strokeWidth={1.8} />
                    <span className="truncate">{table.title}</span>
                  </button>
                ))}
              </div>
            )}
            {data.diagrams && data.diagrams.length > 0 && (
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 px-2"
                  style={{ color: design.colors.text.muted, letterSpacing: design.typography.letterSpacing.widest }}
                >
                  Diagrams
                </p>
                {data.diagrams.map((diagram: any) => (
                  <button
                    key={diagram.id}
                    onClick={() => { setSelectedId(diagram.id); setSelectedType("diagram"); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] transition-colors text-left"
                    style={{
                      backgroundColor: selectedId === diagram.id ? design.colors.bg.elevated : "transparent",
                      color: selectedId === diagram.id ? design.colors.text.primary : design.colors.text.secondary,
                      fontWeight: selectedId === diagram.id ? 500 : 400,
                      boxShadow: selectedId === diagram.id ? design.shadows.sm : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedId !== diagram.id) e.currentTarget.style.backgroundColor = design.colors.bg.hover;
                    }}
                    onMouseLeave={(e) => {
                      if (selectedId !== diagram.id) e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <GitBranch className="w-3.5 h-3.5 flex-shrink-0" style={{ color: design.colors.entity.diagram }} strokeWidth={1.8} />
                    <span className="truncate">{diagram.title}</span>
                  </button>
                ))}
              </div>
            )}
            {data.decks && data.decks.length > 0 && (
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 px-2"
                  style={{ color: design.colors.text.muted, letterSpacing: design.typography.letterSpacing.widest }}
                >
                  Decks
                </p>
                {data.decks.map((deck: any) => (
                  <button
                    key={deck.id}
                    onClick={() => { setSelectedId(deck.id); setSelectedType("deck"); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] transition-colors text-left"
                    style={{
                      backgroundColor: selectedId === deck.id ? design.colors.bg.elevated : "transparent",
                      color: selectedId === deck.id ? design.colors.text.primary : design.colors.text.secondary,
                      fontWeight: selectedId === deck.id ? 500 : 400,
                      boxShadow: selectedId === deck.id ? design.shadows.sm : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedId !== deck.id) e.currentTarget.style.backgroundColor = design.colors.bg.hover;
                    }}
                    onMouseLeave={(e) => {
                      if (selectedId !== deck.id) e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <Presentation className="w-3.5 h-3.5 flex-shrink-0" style={{ color: design.colors.entity.deck }} strokeWidth={1.8} />
                    <span className="truncate">{deck.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden">
          {selectedType === "document" && selectedDoc && (
            <DocViewReadOnly content={selectedDoc.content} />
          )}
          {selectedType === "table" && selectedTable && (
            <SheetViewReadOnly sheets={selectedTable.sheets || []} />
          )}
          {selectedType === "diagram" && selectedDiagram && (
            <DiagramViewReadOnly source={selectedDiagram.source} diagramType={selectedDiagram.diagramType} />
          )}
          {selectedType === "deck" && selectedDeck && (
            <DeckViewReadOnly slides={selectedDeck.slides} theme={selectedDeck.theme} />
          )}
          {!selectedId && (
            <div className="h-full flex items-center justify-center">
              <p className="text-[13px]" style={{ color: design.colors.text.muted }}>
                Select a file from the sidebar
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ShareHeader({ title, subtitle, icon }: { title: string; subtitle?: string; icon: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between px-4 border-b flex-shrink-0"
      style={{
        height: design.layout.headerHeight,
        borderColor: design.colors.border.default,
        backgroundColor: design.colors.bg.secondary,
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icon}
        <div className="min-w-0">
          <p className="text-[13px] font-semibold truncate" style={{ color: design.colors.text.primary }}>
            {title}
          </p>
          {subtitle && (
            <p className="text-[10px] truncate -mt-0.5" style={{ color: design.colors.text.muted }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium" style={{ color: design.colors.text.muted }}>
          Shared via
        </span>
        <a
          href="/"
          className="flex items-center gap-1.5 text-[12px] font-semibold transition-colors"
          style={{ color: design.colors.brand.primary }}
        >
          <Pen className="w-3.5 h-3.5" strokeWidth={2} />
          Drafta
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
