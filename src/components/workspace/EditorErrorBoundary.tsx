"use client";

import React from "react";

interface EditorErrorBoundaryProps {
  children: React.ReactNode;
  entityType: "document" | "spreadsheet" | "presentation";
}

interface EditorErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary that wraps individual editor panels (doc, sheet, deck).
 * Catches rendering errors in the editor area without affecting the chat panel,
 * tab bar, or other workspace chrome.
 *
 * React 19 still requires class components for error boundaries.
 */
export class EditorErrorBoundary extends React.Component<
  EditorErrorBoundaryProps,
  EditorErrorBoundaryState
> {
  constructor(props: EditorErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): EditorErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(
      `[EditorErrorBoundary] ${this.props.entityType} editor crashed:`,
      error,
      errorInfo.componentStack,
    );
  }

  private handleReload = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center bg-[var(--background,#fafaf8)] px-6">
          <div className="flex flex-col items-center text-center max-w-[360px]">
            {/* Warning indicator */}
            <div
              className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border,#e8e8ed)] bg-[var(--color-bg-secondary,#f5f5f3)]"
              aria-hidden="true"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M10 6.5V11M10 13.5V13.51M8.862 3.155 2.107 15.353A1.25 1.25 0 0 0 3.246 17h13.508a1.25 1.25 0 0 0 1.139-1.647L11.138 3.155a1.25 1.25 0 0 0-2.276 0Z"
                  stroke="var(--muted-foreground, #737373)"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Message */}
            <h3 className="text-[15px] font-semibold leading-snug text-[var(--foreground,#1a1a1a)]">
              Something went wrong
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--muted-foreground,#737373)]">
              The {this.props.entityType} editor encountered an error. Your work
              has been auto-saved.
            </p>

            {/* Reload button */}
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-5 inline-flex h-9 items-center justify-center rounded-lg border border-[var(--border,#e8e8ed)] bg-[var(--card,#ffffff)] px-4 text-[13px] font-medium text-[var(--foreground,#1a1a1a)] shadow-sm transition-colors duration-150 hover:bg-[var(--accent,#f4f4f2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring,#ff4a00)] focus-visible:ring-offset-2"
            >
              Reload editor
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
