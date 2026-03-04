"use client";

// Re-export the old structured slide renderer for backward compat with existing decks.
// This will be used only when slides have the old { layout, title, bullets } format.
export { SlideRenderer as LegacySlideRenderer } from "./SlideRenderer";
