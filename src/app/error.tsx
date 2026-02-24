"use client";

import { useEffect } from "react";
import { design } from "@/lib/design";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: design.colors.bg.primary }}
    >
      <div className="text-center max-w-md">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: "rgba(224, 85, 85, 0.1)" }}
        >
          <span className="text-2xl">⚠️</span>
        </div>
        <h2
          className="text-lg font-semibold mb-2"
          style={{ color: design.colors.text.primary }}
        >
          Something went wrong
        </h2>
        <p
          className="text-sm mb-6"
          style={{ color: design.colors.text.muted }}
        >
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-full text-sm font-medium transition-opacity hover:opacity-90"
          style={{
            backgroundColor: design.colors.brand.primary,
            color: "#fff",
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
