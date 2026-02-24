"use client";

import { SheetView } from "./SheetView";
import { SheetErrorBoundary } from "./SheetErrorBoundary";

export function SheetPanel() {
  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-primary)]">
      <div className="flex-1 overflow-hidden">
        <SheetErrorBoundary>
          <SheetView />
        </SheetErrorBoundary>
      </div>
    </div>
  );
}
