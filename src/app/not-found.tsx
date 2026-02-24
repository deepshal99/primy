import Link from "next/link";
import { design } from "@/lib/design";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: design.colors.bg.primary }}
    >
      <div className="text-center max-w-md">
        <div
          className="text-6xl font-bold mb-2"
          style={{ color: design.colors.text.muted }}
        >
          404
        </div>
        <h2
          className="text-lg font-semibold mb-2"
          style={{ color: design.colors.text.primary }}
        >
          Page not found
        </h2>
        <p
          className="text-sm mb-6"
          style={{ color: design.colors.text.muted }}
        >
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 rounded-full text-sm font-medium transition-opacity hover:opacity-90"
          style={{
            backgroundColor: design.colors.brand.primary,
            color: "#fff",
          }}
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
