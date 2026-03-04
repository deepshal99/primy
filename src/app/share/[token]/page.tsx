"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { cn } from "@/lib/cn";
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
  | { type: "diagram"; title: string; diagramType: "mermaid" | "chart" | "excalidraw" | "reactflow"; source: string; projectTitle: string }
  | { type: "deck"; title: string; slides: any[]; theme: string; style?: any; projectTitle: string }
  | { type: "project"; title: string; description?: string; documents: any[]; tables: any[]; diagrams?: any[]; decks?: any[] };

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-[#ff4a00]" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center px-8 max-w-md">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-destructive/10">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <div>
            <p className="text-base font-semibold mb-1 text-foreground">
              Link not found
            </p>
            <p className="text-[13px] text-muted-foreground">
              {error || "This shared link is no longer available."}
            </p>
          </div>
          <a
            href="/"
            className="text-[13px] font-medium px-4 py-2 rounded-lg bg-[rgba(255,74,0,0.06)] text-[#ff4a00] transition-colors hover:bg-[rgba(255,74,0,0.12)]"
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
      <div className="h-screen flex flex-col bg-background animate-in fade-in duration-300">
        <ShareHeader title={data.title} subtitle={data.projectTitle} icon={<FileText className="w-4 h-4 text-[#4a7aed]" />} />
        <div className="flex-1 overflow-hidden">
          <DocViewReadOnly content={data.content} />
        </div>
      </div>
    );
  }

  // Single table
  if (data.type === "table") {
    return (
      <div className="h-screen flex flex-col bg-background animate-in fade-in duration-300">
        <ShareHeader title={data.title} subtitle={data.projectTitle} icon={<Table2 className="w-4 h-4 text-[#2e9e47]" />} />
        <div className="flex-1 overflow-hidden">
          <SheetViewReadOnly sheets={data.sheets || []} />
        </div>
      </div>
    );
  }

  // Single diagram
  if (data.type === "diagram") {
    return (
      <div className="h-screen flex flex-col bg-background animate-in fade-in duration-300">
        <ShareHeader title={data.title} subtitle={data.projectTitle} icon={<GitBranch className="w-4 h-4 text-[#7c5cb8]" />} />
        <div className="flex-1 overflow-hidden">
          <DiagramViewReadOnly source={data.source} diagramType={data.diagramType} />
        </div>
      </div>
    );
  }

  // Single deck
  if (data.type === "deck") {
    return (
      <div className="h-screen flex flex-col bg-background animate-in fade-in duration-300">
        <ShareHeader title={data.title} subtitle={data.projectTitle} icon={<Presentation className="w-4 h-4 text-[#d4582a]" />} />
        <div className="flex-1 overflow-hidden">
          <DeckViewReadOnly slides={data.slides} theme={data.theme} style={data.style} />
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
    <div className="h-screen flex flex-col bg-background animate-in fade-in duration-300">
      <ShareHeader
        title={data.title}
        subtitle={data.description || "Shared project"}
        icon={<FolderOpen className="w-4 h-4 text-[#ff4a00]" />}
      />
      <div className="flex-1 flex overflow-hidden">
        {/* File sidebar */}
        <div className="w-[220px] flex-shrink-0 border-r border-border overflow-y-auto bg-muted/50">
          <div className="p-3">
            {data.documents?.length > 0 && (
              <SidebarSection title="Documents">
                {data.documents.map((doc: any) => (
                  <SidebarItem
                    key={doc.id}
                    icon={<FileText className="w-3.5 h-3.5 text-[#4a7aed]" strokeWidth={1.8} />}
                    label={doc.title}
                    isActive={selectedId === doc.id}
                    onClick={() => { setSelectedId(doc.id); setSelectedType("document"); }}
                  />
                ))}
              </SidebarSection>
            )}
            {data.tables?.length > 0 && (
              <SidebarSection title="Tables">
                {data.tables.map((table: any) => (
                  <SidebarItem
                    key={table.id}
                    icon={<Table2 className="w-3.5 h-3.5 text-[#2e9e47]" strokeWidth={1.8} />}
                    label={table.title}
                    isActive={selectedId === table.id}
                    onClick={() => { setSelectedId(table.id); setSelectedType("table"); }}
                  />
                ))}
              </SidebarSection>
            )}
            {data.diagrams && data.diagrams.length > 0 && (
              <SidebarSection title="Diagrams">
                {data.diagrams.map((diagram: any) => (
                  <SidebarItem
                    key={diagram.id}
                    icon={<GitBranch className="w-3.5 h-3.5 text-[#7c5cb8]" strokeWidth={1.8} />}
                    label={diagram.title}
                    isActive={selectedId === diagram.id}
                    onClick={() => { setSelectedId(diagram.id); setSelectedType("diagram"); }}
                  />
                ))}
              </SidebarSection>
            )}
            {data.decks && data.decks.length > 0 && (
              <SidebarSection title="Decks">
                {data.decks.map((deck: any) => (
                  <SidebarItem
                    key={deck.id}
                    icon={<Presentation className="w-3.5 h-3.5 text-[#d4582a]" strokeWidth={1.8} />}
                    label={deck.title}
                    isActive={selectedId === deck.id}
                    onClick={() => { setSelectedId(deck.id); setSelectedType("deck"); }}
                  />
                ))}
              </SidebarSection>
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
            <DeckViewReadOnly slides={selectedDeck.slides} theme={selectedDeck.theme} style={selectedDeck.style} />
          )}
          {!selectedId && (
            <div className="h-full flex items-center justify-center">
              <p className="text-[13px] text-muted-foreground">
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
    <div className="flex items-center justify-between px-4 border-b border-border flex-shrink-0 h-12 bg-muted/50">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon}
        <div className="min-w-0">
          <p className="text-[13px] font-semibold truncate text-foreground">
            {title}
          </p>
          {subtitle && (
            <p className="text-[10px] truncate -mt-0.5 text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">
          Shared via
        </span>
        <a
          href="/"
          className="flex items-center gap-1.5 text-xs font-semibold text-[#ff4a00] transition-colors hover:opacity-80"
        >
          <Pen className="w-3.5 h-3.5" strokeWidth={2} />
          Drafta
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5 px-2 text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function SidebarItem({ icon, label, isActive, onClick }: { icon: React.ReactNode; label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors text-left",
        isActive
          ? "bg-card text-foreground font-medium shadow-sm"
          : "text-muted-foreground hover:bg-accent"
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
