"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Top navigation for the marketing pages (`/`, `/pricing`).
 * Sticky; gains a backdrop-blur + faint border once the user scrolls.
 * Minimal: wordmark on the left, two CTAs on the right.
 */
export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-[background-color,backdrop-filter,border-color] duration-200 ease-out",
        scrolled
          ? "bg-white/70 backdrop-blur-md border-b border-[rgba(0,0,0,0.06)]"
          : "bg-transparent border-b border-transparent"
      )}
    >
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link
          href="/"
          aria-label="Primy home"
          className="flex items-center gap-2 group"
        >
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-[8px]"
            style={{ backgroundColor: "#1A1815" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5 3 L5 21 L13.5 21 C18.5 21 21 17 21 12 C21 7 18.5 3 13.5 3 Z"
                fill="white"
              />
              <path
                d="M9 7 L12.5 7 C15.8 7 17 9.5 17 12 C17 14.5 15.8 17 12.5 17 L9 17 Z"
                fill="#FFB43F"
              />
            </svg>
          </span>
          <span className="text-[15px] font-medium tracking-[-0.01em] text-[#171717]">
            Primy
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/pricing"
            className="hidden sm:inline-flex h-9 items-center px-3 rounded-[6px] text-[13px] font-medium text-[#525252] hover:text-[#171717] hover:bg-[rgba(0,0,0,0.04)] transition-colors duration-150"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="inline-flex h-9 items-center px-3 rounded-[6px] text-[13px] font-medium text-[#525252] hover:text-[#171717] hover:bg-[rgba(0,0,0,0.04)] transition-colors duration-150"
          >
            Sign in
          </Link>
          <Link
            href="/login?mode=signup"
            className="inline-flex h-9 items-center px-3.5 rounded-[6px] text-[13px] font-medium text-white transition-all duration-150 hover:brightness-95 active:scale-[0.99] ml-1"
            style={{ backgroundColor: "#1A1815" }}
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
