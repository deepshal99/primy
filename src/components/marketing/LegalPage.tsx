import Link from "next/link";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

/**
 * Shared scaffold for the legal pages (/privacy, /terms).
 * Server component, matches the marketing surfaces: warm near-white, ink text.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FCFBF8] text-[#171717]">
      <header className="mx-auto max-w-[720px] px-6 pt-10 pb-2">
        <Link href="/" className="inline-flex items-center gap-2">
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-[6px]"
            style={{ backgroundColor: "#1A1815" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 3 L5 21 L13.5 21 C18.5 21 21 17 21 12 C21 7 18.5 3 13.5 3 Z" fill="white" />
              <path d="M9 7 L12.5 7 C15.8 7 17 9.5 17 12 C17 14.5 15.8 17 12.5 17 L9 17 Z" fill="#FFB43F" />
            </svg>
          </span>
          <span className="text-[13px] font-medium">Primy</span>
        </Link>
      </header>
      <main className="mx-auto max-w-[720px] px-6 py-12">
        <h1 className="text-[28px] font-medium tracking-[-0.02em] mb-1">{title}</h1>
        <p className="text-[13px] text-[#706E68] mb-10 tabular-nums">Last updated {updated}</p>
        <div className="legal-prose space-y-8 text-[14.5px] leading-[1.7] text-[#3B3A37]">
          {children}
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[16px] font-semibold text-[#171717] mb-2.5">{heading}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
