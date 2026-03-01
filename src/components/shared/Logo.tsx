"use client";

import { Pen } from "lucide-react";

export function Logo() {
  return (
    <div className="flex items-center gap-2 cursor-default select-none">
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#ff4a00]">
        <Pen className="w-3.5 h-3.5 text-white" strokeWidth={2} />
      </div>
      <span className="text-heading font-heading text-[#1a1a2e]">
        Drafta AI
      </span>
    </div>
  );
}
