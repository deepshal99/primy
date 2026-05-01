"use client";

/**
 * LimitReachedModal — shown when an API call returns 402 plan_limit_exceeded.
 *
 * Currently dormant. Build the component now; wiring to actual 402
 * responses lands once payment gateway is integrated. The upgrade CTA
 * is intentionally a no-op (logs a "Coming soon" message) until then.
 */

import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PRO_PRICE_USD } from "@/lib/plans";
import type { Plan, MeteredResource } from "@/lib/plans";

interface LimitReachedModalProps {
  open: boolean;
  onClose: () => void;
  plan: Plan;
  resource: MeteredResource;
  used: number;
  limit: number;
  onUpgradeClick?: () => void;
}

const RESOURCE_LABEL: Record<MeteredResource, { noun: string; verb: string }> = {
  aiMessages: { noun: "AI messages", verb: "used" },
  fileUploads: { noun: "file uploads", verb: "used" },
};

function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US");
}

export function LimitReachedModal({
  open,
  onClose,
  plan,
  resource,
  used,
  limit,
  onUpgradeClick,
}: LimitReachedModalProps) {
  const label = RESOURCE_LABEL[resource];
  const planLabel = plan === "free" ? "Free" : "Pro";

  const handleUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
      return;
    }
    // Default no-op until payment gateway lands.
    console.info("[LimitReachedModal] Upgrade clicked — gateway not yet wired.");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="sm:max-w-[440px] p-0 gap-0 overflow-hidden tabular-nums"
        style={{
          borderRadius: 12,
          fontFeatureSettings: "'tnum'",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-4">
          <div
            className="mb-3 inline-flex h-9 w-9 items-center justify-center"
            style={{
              borderRadius: 8,
              backgroundColor: "rgba(255, 74, 0, 0.10)",
              color: "#fa5d19",
            }}
          >
            <Sparkles className="h-4 w-4" />
          </div>
          <DialogTitle className="text-[17px] leading-tight tracking-tight">
            You&rsquo;ve hit your monthly limit
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-snug text-muted-foreground">
            You&rsquo;ve {label.verb} {formatCount(used)}/{formatCount(limit)} {label.noun}{" "}
            this month on the {planLabel} plan. Upgrade to keep going.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-3">
          <div
            className="flex items-start gap-3 px-3.5 py-3"
            style={{
              borderRadius: 8,
              backgroundColor: "rgba(0, 0, 0, 0.02)",
              border: "1px solid rgba(0, 0, 0, 0.04)",
            }}
          >
            <div
              className="mt-0.5 h-1.5 w-1.5 flex-shrink-0"
              style={{ borderRadius: 9999, backgroundColor: "#fa5d19" }}
            />
            <p className="text-[12px] leading-snug text-muted-foreground">
              Pro includes 1,500 messages/mo, brand profiles, no watermark, and more.
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 px-6 pb-6 pt-3 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-[13px]"
            style={{ borderRadius: 6 }}
          >
            Maybe later
          </Button>
          <Button
            onClick={handleUpgrade}
            className="text-[13px] font-medium text-white transition-all"
            style={{
              borderRadius: 6,
              backgroundColor: "#fa5d19",
              boxShadow: "0 1px 2px rgba(250, 93, 25, 0.15)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#e04300";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#fa5d19";
            }}
          >
            Upgrade to Pro &mdash; ${PRO_PRICE_USD}/mo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
