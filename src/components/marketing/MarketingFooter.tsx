import Link from "next/link";

/**
 * Marketing footer used by `/` and `/pricing`.
 * Pure presentational — server component.
 */
export function MarketingFooter() {
  return (
    <footer className="border-t border-[rgba(0,0,0,0.06)] bg-white">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-[6px]"
            style={{ backgroundColor: "#1A1815" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
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
          <span className="text-[13px] font-medium text-[#171717]">Primy</span>
          <span className="text-[12px] text-[#a3a3a3] ml-2 tabular-nums">
            © 2026
          </span>
        </div>

        <nav className="flex items-center gap-5 text-[12px] text-[#737373]">
          <Link href="#privacy" className="hover:text-[#171717] transition-colors duration-150">
            Privacy
          </Link>
          <Link href="#terms" className="hover:text-[#171717] transition-colors duration-150">
            Terms
          </Link>
          <a
            href="#twitter"
            className="hover:text-[#171717] transition-colors duration-150"
          >
            Twitter
          </a>
          <a
            href="#github"
            className="hover:text-[#171717] transition-colors duration-150"
          >
            GitHub
          </a>
          <Link href="/pricing" className="hover:text-[#171717] transition-colors duration-150">
            Pricing
          </Link>
        </nav>
      </div>
    </footer>
  );
}
