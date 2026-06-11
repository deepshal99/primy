"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  FileText,
  Table2,
  Presentation,
  FolderOpen,
  AlertCircle,
  Pen,
  ExternalLink,
  ArrowUpRight,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ShareWatermark } from "@/components/billing/ShareWatermark";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import type { Plan } from "@/lib/plans";

const DocViewReadOnly = dynamic(
  () => import("@/components/doc/DocViewReadOnly").then((m) => m.DocViewReadOnly),
  { ssr: false }
);
const SheetViewReadOnly = dynamic(
  () => import("@/components/sheet/SheetViewReadOnly").then((m) => m.SheetViewReadOnly),
  { ssr: false }
);
const DeckViewReadOnly = dynamic(
  () => import("@/components/deck/DeckViewReadOnly").then((m) => m.DeckViewReadOnly),
  { ssr: false }
);

type ShareData =
  | { type: "document"; title: string; content: string; projectTitle: string; ownerEffectivePlan: Plan }
  | { type: "table"; title: string; sheets: any[]; projectTitle: string; ownerEffectivePlan: Plan }
  | { type: "deck"; title: string; slides: any[]; theme: string; style?: any; projectTitle: string; ownerEffectivePlan: Plan }
  | { type: "project"; title: string; description?: string; documents: any[]; tables: any[]; decks?: any[]; ownerEffectivePlan: Plan };

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"document" | "table" | "deck" | null>(null);

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
    return <LoadingScreen variant="light" label="Loading..." />;
  }

  if (error || !data) {
    return (
      <div className="h-screen flex items-center justify-center bg-white antialiased">
        <div className="flex flex-col items-center gap-4 text-center px-8 max-w-md">
          <div
            className="w-14 h-14 flex items-center justify-center"
            style={{ borderRadius: 12, backgroundColor: "rgba(235, 52, 36, 0.08)" }}
          >
            <AlertCircle className="w-7 h-7 text-[#eb3424]" />
          </div>
          <div>
            <p className="text-base font-semibold mb-1 text-neutral-900">
              Link not found
            </p>
            <p className="text-[13px] text-neutral-500">
              {error || "This shared link is no longer available."}
            </p>
          </div>
          <Link
            href="/"
            className="text-[13px] font-medium px-4 py-2 transition-colors"
            style={{
              borderRadius: 6,
              backgroundColor: "rgba(255, 180, 63, 0.08)",
              color: "#B87426",
            }}
          >
            Go to Primy
          </Link>
        </div>
      </div>
    );
  }

  const ownerEffectivePlan: Plan = data.ownerEffectivePlan;
  const showOpenInPrimyCta = ownerEffectivePlan === "free";

  // Single document
  if (data.type === "document") {
    return (
      <ShareLayout ownerEffectivePlan={ownerEffectivePlan}>
        <ShareHeader
          title={data.title}
          breadcrumb={data.projectTitle ? [data.projectTitle, data.title] : [data.title]}
          icon={<FileText className="w-4 h-4 text-[#2a6dfb]" strokeWidth={1.8} />}
        />
        <div className="flex-1 overflow-hidden">
          <DocViewReadOnly content={data.content} />
        </div>
        {showOpenInPrimyCta && <OpenInPrimyCta />}
      </ShareLayout>
    );
  }

  // Single table
  if (data.type === "table") {
    return (
      <ShareLayout ownerEffectivePlan={ownerEffectivePlan}>
        <ShareHeader
          title={data.title}
          breadcrumb={data.projectTitle ? [data.projectTitle, data.title] : [data.title]}
          icon={<Table2 className="w-4 h-4 text-[#42c366]" strokeWidth={1.8} />}
        />
        <div className="flex-1 overflow-hidden">
          <SheetViewReadOnly sheets={data.sheets || []} />
        </div>
        {showOpenInPrimyCta && <OpenInPrimyCta />}
      </ShareLayout>
    );
  }

  // Single deck
  if (data.type === "deck") {
    return (
      <ShareLayout ownerEffectivePlan={ownerEffectivePlan}>
        <ShareHeader
          title={data.title}
          breadcrumb={data.projectTitle ? [data.projectTitle, data.title] : [data.title]}
          icon={<Presentation className="w-4 h-4 text-[#FFAD45]" strokeWidth={1.8} />}
        />
        <div className="flex-1 overflow-hidden">
          <DeckViewReadOnly slides={data.slides} theme={data.theme} style={data.style} />
        </div>
        {showOpenInPrimyCta && <OpenInPrimyCta />}
      </ShareLayout>
    );
  }

  // Project view
  const selectedDoc = data.documents?.find((d: any) => d.id === selectedId);
  const selectedTable = data.tables?.find((t: any) => t.id === selectedId);
  const selectedDeck = data.decks?.find((d: any) => d.id === selectedId);

  return (
    <ShareLayout ownerEffectivePlan={ownerEffectivePlan}>
      <ShareHeader
        title={data.title}
        breadcrumb={[data.title]}
        subtitle={data.description || "Shared project"}
        icon={<FolderOpen className="w-4 h-4 text-[#FFAD45]" strokeWidth={1.8} />}
      />
      <div className="flex-1 flex overflow-hidden">
        {/* File sidebar */}
        <div
          className="w-[220px] flex-shrink-0 overflow-y-auto"
          style={{
            borderRight: "1px solid rgba(0, 0, 0, 0.06)",
            backgroundColor: "#fafafa",
          }}
        >
          <div className="p-3">
            {data.documents?.length > 0 && (
              <SidebarSection title="Documents">
                {data.documents.map((doc: any) => (
                  <SidebarItem
                    key={doc.id}
                    icon={<FileText className="w-3.5 h-3.5 text-[#2a6dfb]" strokeWidth={1.8} />}
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
                    icon={<Table2 className="w-3.5 h-3.5 text-[#42c366]" strokeWidth={1.8} />}
                    label={table.title}
                    isActive={selectedId === table.id}
                    onClick={() => { setSelectedId(table.id); setSelectedType("table"); }}
                  />
                ))}
              </SidebarSection>
            )}
            {data.decks && data.decks.length > 0 && (
              <SidebarSection title="Decks">
                {data.decks.map((deck: any) => (
                  <SidebarItem
                    key={deck.id}
                    icon={<Presentation className="w-3.5 h-3.5 text-[#FFAD45]" strokeWidth={1.8} />}
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
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-hidden">
            {selectedType === "document" && selectedDoc && (
              <DocViewReadOnly content={selectedDoc.content} />
            )}
            {selectedType === "table" && selectedTable && (
              <SheetViewReadOnly sheets={selectedTable.sheets || []} />
            )}
            {selectedType === "deck" && selectedDeck && (
              <DeckViewReadOnly slides={selectedDeck.slides} theme={selectedDeck.theme} style={selectedDeck.style} />
            )}
            {!selectedId && (
              <div className="h-full flex items-center justify-center">
                <p className="text-[13px] text-neutral-500">
                  Select a file from the sidebar
                </p>
              </div>
            )}
          </div>
          {showOpenInPrimyCta && <OpenInPrimyCta />}
        </div>
      </div>
    </ShareLayout>
  );
}

/**
 * Layout-level wrapper. Renders the watermark exactly once per share
 * page (per eng-review decision #12 — single layout-level component,
 * never inside the inner ReadOnly viewers). Pro owners get a clean
 * canvas — the component itself returns null in that case.
 */
function ShareLayout({
  ownerEffectivePlan,
  children,
}: {
  ownerEffectivePlan: Plan;
  children: React.ReactNode;
}) {
  return (
    <div
      className="h-screen flex flex-col bg-white antialiased animate-in fade-in duration-300"
      style={{ WebkitFontSmoothing: "antialiased" as const }}
    >
      {children}
      <ShareWatermark ownerPlan={ownerEffectivePlan} />
    </div>
  );
}

function ShareHeader({
  title,
  subtitle,
  breadcrumb,
  icon,
}: {
  title: string;
  subtitle?: string;
  breadcrumb?: string[];
  icon: React.ReactNode;
}) {
  const crumbs = breadcrumb && breadcrumb.length > 0 ? breadcrumb : [title];
  return (
    <div
      className="flex items-center justify-between px-5 flex-shrink-0 h-12"
      style={{
        borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
        backgroundColor: "#ffffff",
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="flex-shrink-0">{icon}</span>
        <div className="min-w-0 flex flex-col leading-tight">
          <div className="flex items-center gap-1 min-w-0">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1 min-w-0">
                {i > 0 && (
                  <span
                    aria-hidden="true"
                    className="text-neutral-300 text-[12px] flex-shrink-0"
                  >
                    /
                  </span>
                )}
                <span
                  className={cn(
                    "text-[13px] truncate",
                    i === crumbs.length - 1
                      ? "font-semibold text-neutral-900"
                      : "text-neutral-500"
                  )}
                  style={{ letterSpacing: "-0.005em" }}
                >
                  {c}
                </span>
              </span>
            ))}
          </div>
          {subtitle && (
            <p className="text-[11px] truncate text-neutral-500 -mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <a
          href="/?ref=share-header"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[12px] font-medium text-neutral-500 transition-colors hover:text-neutral-900"
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid rgba(0, 0, 0, 0.06)",
            backgroundColor: "#ffffff",
            letterSpacing: "-0.005em",
          }}
        >
          <Pen className="w-3 h-3 text-[#FFB43F]" strokeWidth={2} />
          Created with <span className="text-neutral-900 font-semibold">Primy</span>
          <ExternalLink className="w-3 h-3 text-neutral-400" />
        </a>
      </div>
    </div>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p
        className="text-[10px] font-semibold uppercase tracking-widest mb-1.5 px-2 text-neutral-400"
        style={{ letterSpacing: "0.08em" }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 text-[12px] transition-colors text-left",
        isActive
          ? "bg-white text-neutral-900 font-medium"
          : "text-neutral-600 hover:bg-white/60"
      )}
      style={{
        borderRadius: 6,
        boxShadow: isActive ? "0 1px 2px rgba(0, 0, 0, 0.04)" : undefined,
        letterSpacing: "-0.005em",
      }}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

/**
 * Bottom-of-artifact "Open in Primy" CTA. Pulls visitors toward signup.
 * Free-tier shares only — paid users get clean shares.
 */
function OpenInPrimyCta() {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 px-5 py-4"
      style={{
        borderTop: "1px solid rgba(0, 0, 0, 0.04)",
        backgroundColor: "#fafafa",
      }}
    >
      <a
        href="/?ref=share-cta"
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-2 px-3.5 py-2 text-[12.5px] font-medium text-white transition-all duration-150 ease-out hover:-translate-y-0.5"
        style={{
          backgroundColor: "#1A1815",
          borderRadius: 6,
          letterSpacing: "-0.005em",
          boxShadow: "0 1px 2px rgba(24, 24, 22, 0.18), 0 4px 12px rgba(24, 24, 22, 0.16)",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        Make your own with Primy
        <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-150 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2.2} />
      </a>
    </div>
  );
}
