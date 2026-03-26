import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

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
        <QueryProvider>
          <SessionProvider>
            {children}
          </SessionProvider>
        </QueryProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '13px',
              color: 'var(--foreground)',
              padding: '14px 16px',
            },
          }}
        />
      </body>
    </html>
  );
}
