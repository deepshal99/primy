"use client";

import { useAppStore } from "@/lib/store";
import { DeckGatheringView } from "./DeckGatheringView";
import { DeckOutlineEditor } from "./DeckOutlineEditor";
import { DeckThemePicker } from "./DeckThemePicker";
import { DeckGeneratingView } from "./DeckGeneratingView";
import { DeckLinearView } from "./DeckLinearView";
import type { DeckPhase } from "@/lib/types";

const PHASE_VIEWS: Record<DeckPhase, React.ComponentType> = {
  gathering: DeckGatheringView,
  outlining: DeckOutlineEditor,
  theming: DeckThemePicker,
  generating: DeckGeneratingView,
  viewing: DeckLinearView,
};

export function DeckBuilder() {
  const phase = useAppStore((s) => s.deckPhase);
  const View = PHASE_VIEWS[phase];

  return (
    <div className="h-full">
      <View />
    </div>
  );
}
