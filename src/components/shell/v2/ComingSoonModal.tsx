"use client";

import { Plug, Bot, Workflow, Globe } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Roadmap teaser — sets expectations and excites testers. Static list; update
// as items ship. Token-based so it adapts to light and dark.

const ITEMS: { icon: typeof Plug; title: string; body: string }[] = [
  { icon: Plug, title: "MCP connections", body: "Plug in your tools and data sources so the AI works with your stack." },
  { icon: Bot, title: "Deploy agents", body: "Hand off multi-step tasks to agents that run on their own." },
  { icon: Workflow, title: "Routines & automation", body: "Schedule recurring work, reports, and updates without lifting a finger." },
  { icon: Globe, title: "Web search", body: "Pull live information from the web straight into your projects." },
];

interface ComingSoonModalProps {
  open: boolean;
  onClose: () => void;
}

export function ComingSoonModal({ open, onClose }: ComingSoonModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="sm:max-w-[520px] p-0 gap-0 overflow-hidden border-0 shadow-none"
        style={{ background: "var(--card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-pane)", borderRadius: 16 }}
      >
        <DialogHeader className="px-6 pt-6 pb-1 space-y-1">
          <DialogTitle className="text-[17px] font-semibold tracking-[-0.01em]" style={{ color: "var(--ink)" }}>
            What&apos;s next
          </DialogTitle>
          <DialogDescription className="text-[13px]" style={{ color: "var(--ink-3)" }}>
            On the way to Primy. Here&apos;s what we&apos;re building next.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 grid sm:grid-cols-2 gap-3">
          {ITEMS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="p-4"
              style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--secondary)" }}
            >
              <div className="flex items-center justify-between mb-2.5">
                <span
                  className="inline-flex h-8 w-8 items-center justify-center"
                  style={{ borderRadius: 8, background: "var(--muted)", color: "var(--ink-2)" }}
                >
                  <Icon className="w-4 h-4" strokeWidth={1.75} />
                </span>
                <span
                  className="text-[10px] font-medium uppercase tracking-wide px-2 py-0.5"
                  style={{ borderRadius: 9999, background: "rgba(255,180,63,0.14)", color: "var(--accent-amber-deep)" }}
                >
                  Coming soon
                </span>
              </div>
              <p className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>{title}</p>
              <p className="mt-1 text-[12px] leading-snug" style={{ color: "var(--ink-3)" }}>{body}</p>
            </div>
          ))}
        </div>

        <div className="px-6 pb-5 -mt-1">
          <p className="text-[12px]" style={{ color: "var(--ink-3)" }}>
            Want something specific? Tell us in your feedback, it shapes what ships first.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
