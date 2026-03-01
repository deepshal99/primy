"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { createEmptySheet } from "@/lib/sheet/defaultData";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class SheetErrorBoundaryInner extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    useAppStore.getState().updateSheetData(createEmptySheet());
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
          <AlertTriangle className="w-10 h-10 text-[#ff4a00]" />
          <h3 className="text-lg font-semibold text-foreground">
            Spreadsheet Error
          </h3>
          <p className="text-sm text-center max-w-md text-muted-foreground">
            The spreadsheet encountered an error and could not render. You can
            reset it to an empty sheet to recover.
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-[#ff4a00] text-white hover:bg-[#e54400]"
          >
            <RefreshCw className="w-4 h-4" />
            Reset Sheet
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export { SheetErrorBoundaryInner as SheetErrorBoundary };
