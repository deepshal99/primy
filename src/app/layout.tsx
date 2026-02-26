import type { Metadata } from "next";
import { Toaster } from "sonner";
import { Agentation } from "agentation";
import { SessionProvider } from "@/components/providers/SessionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drafta AI — AI-Powered Workspace",
  description: "Your AI-powered workspace for documents, spreadsheets, and projects.",
};

// Inline script to set theme before hydration (prevents flash)
const themeScript = `(function(){try{var t=localStorage.getItem('drafta-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light')}catch(e){}})()`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <SessionProvider>
          {children}
        </SessionProvider>
        {process.env.NODE_ENV === "development" && <Agentation />}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
              fontSize: "13px",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
            },
          }}
        />
      </body>
    </html>
  );
}
