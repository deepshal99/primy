"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#ffffff",
            padding: "1rem",
          }}
        >
          <div style={{ textAlign: "center", maxWidth: 400 }}>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#1a1a2e",
                marginBottom: 8,
              }}
            >
              Something went wrong
            </h2>
            <p
              style={{
                fontSize: 14,
                color: "#6b6b80",
                marginBottom: 24,
              }}
            >
              A critical error occurred. Please try refreshing the page.
            </p>
            <button
              onClick={reset}
              style={{
                padding: "10px 20px",
                borderRadius: 9999,
                border: "none",
                backgroundColor: "#1A1815",
                color: "#fff",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
