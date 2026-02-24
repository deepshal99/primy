import type { Metadata } from "next";
import { Toaster } from "sonner";
import { SessionProvider } from "@/components/providers/SessionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drafta AI — AI-Powered Workspace",
  description: "Your AI-powered workspace for documents, spreadsheets, and projects.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SessionProvider>
          {children}
        </SessionProvider>
        <Toaster
          theme="light"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#FDFCFB",
              border: "1px solid #E0DDD8",
              color: "#21201C",
              fontSize: "13px",
              boxShadow: "0 4px 16px rgba(33, 32, 28, 0.08)",
            },
          }}
        />
      </body>
    </html>
  );
}
