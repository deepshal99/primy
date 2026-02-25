"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import "@fortune-sheet/react/dist/index.css";
import { SheetData } from "@/lib/types";

const Workbook = dynamic(
  () => import("@fortune-sheet/react").then((mod) => mod.Workbook),
  { ssr: false }
);

interface SheetViewReadOnlyProps {
  sheets: SheetData[];
}

export function SheetViewReadOnly({ sheets }: SheetViewReadOnlyProps) {
  // Force layout recalc after mount
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Ensure sheets have proper structure
  const normalizedSheets = sheets.map((s, i) => ({
    ...s,
    celldata: Array.isArray(s.celldata) ? s.celldata : [],
    order: s.order ?? i,
    status: i === 0 ? 1 : 0,
    row: s.row || 50,
    column: s.column || 26,
    config: s.config || {},
  }));

  return (
    <div className="w-full h-full">
      <Workbook
        data={normalizedSheets as any}
        onChange={() => {}}
        allowEdit={false}
        showToolbar={false}
        showFormulaBar={false}
        showSheetTabs={normalizedSheets.length > 1}
      />
    </div>
  );
}
