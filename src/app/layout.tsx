import type { Metadata } from "next";
import { Toaster } from "sonner";
import { Agentation } from "agentation";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drafta AI — AI-Powered Workspace",
  description: "Your AI-powered workspace for documents, spreadsheets, and projects.",
};

// Inline script to set theme before hydration (prevents flash)
// Sets both .dark class (shadcn) and data-theme attribute (legacy/Excalidraw)
const themeScript = `(function(){try{var t=localStorage.getItem('drafta-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.setAttribute('data-theme',d?'dark':'light')}catch(e){}})()`;


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <QueryProvider>
          <SessionProvider>
            {children}
          </SessionProvider>
        </QueryProvider>
        {process.env.NODE_ENV === "development" && <Agentation />}
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
