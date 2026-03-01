import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="text-center max-w-md">
        <div className="text-6xl font-bold mb-2 text-muted-foreground">
          404
        </div>
        <h2 className="text-lg font-semibold mb-2 text-foreground">
          Page not found
        </h2>
        <p className="text-sm mb-6 text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-5 py-2.5 rounded-full text-sm font-medium transition-opacity hover:opacity-90 bg-primary text-primary-foreground"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
