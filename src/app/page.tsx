import type { Metadata } from "next";
import { RedirectIfAuthenticated } from "@/components/marketing/RedirectIfAuthenticated";
import Landing from "@/components/marketing/landing/Landing";

export const dynamic = "force-static";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Primy: The AI studio for client-ready docs, sheets, decks, and pages",
  description:
    "Chat to create and edit docs, sheets, decks, and pages. Drag in any file. Per-client memory keeps everything connected, so you never copy-paste from ChatGPT again.",
};

/* ──────────────────────────────────────────────
   Marketing landing ("/"): thin server wrapper
   around the shared Landing client component.
   ────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <>
      <RedirectIfAuthenticated />
      <Landing />
    </>
  );
}
