"use client";

import { Pen } from "lucide-react";
import { design } from "@/lib/design";

export function Logo() {
  return (
    <div className="flex items-center gap-2 cursor-default select-none">
      <div
        className="flex items-center justify-center w-7 h-7 rounded-lg"
        style={{ backgroundColor: design.colors.brand.primary }}
      >
        <Pen className="w-3.5 h-3.5 text-white" strokeWidth={2} />
      </div>
      <span
        className="text-heading font-heading"
        style={{ color: design.colors.text.primary }}
      >
        Drafta AI
      </span>
    </div>
  );
}
