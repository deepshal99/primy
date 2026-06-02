import type { Metadata, Viewport } from "next";
import { DialRoot } from "dialkit";
import { AppToaster } from "@/components/ui/AppToaster";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import "dialkit/styles.css";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "Primy — AI-Powered Workspace",
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
        <AppToaster />
        <DialRoot position="bottom-right" defaultOpen={false} />
      </body>
    </html>
  );
}
