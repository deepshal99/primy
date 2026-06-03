import { describe, it, expect } from "vitest";
import {
  inferStreamTask,
  taskFromOp,
  activePhaseIndex,
  PHASE_SCRIPTS,
  PHASE_STEP_MS,
} from "@/lib/streamPhases";

describe("inferStreamTask", () => {
  it("detects deck", () => {
    expect(inferStreamTask("make me a pitch deck for investors")).toBe("deck");
    expect(inferStreamTask("build a presentation about Q3")).toBe("deck");
  });
  it("detects sheet", () => {
    expect(inferStreamTask("create a budget tracker spreadsheet")).toBe("sheet");
  });
  it("detects doc", () => {
    expect(inferStreamTask("write a memo to the team")).toBe("doc");
  });
  it("detects page", () => {
    expect(inferStreamTask("make a landing page for the launch")).toBe("page");
  });
  it("falls back to answer", () => {
    expect(inferStreamTask("what is the capital of France?")).toBe("answer");
  });
});

describe("taskFromOp", () => {
  it("maps op types, outline counts as deck", () => {
    expect(taskFromOp("sheet")).toBe("sheet");
    expect(taskFromOp("deck")).toBe("deck");
    expect(taskFromOp("outline")).toBe("deck");
    expect(taskFromOp("page")).toBe("page");
    expect(taskFromOp("doc")).toBe("doc");
    expect(taskFromOp(null)).toBeNull();
  });
});

describe("activePhaseIndex", () => {
  const deckCount = PHASE_SCRIPTS.deck.length; // 4

  it("starts at 0", () => {
    expect(activePhaseIndex({ phaseCount: deckCount, elapsedMs: 0, outputStarted: false })).toBe(0);
  });
  it("advances on the timer", () => {
    expect(activePhaseIndex({ phaseCount: deckCount, elapsedMs: PHASE_STEP_MS + 10, outputStarted: false })).toBe(1);
  });
  it("holds at the second-to-last step until output starts", () => {
    expect(activePhaseIndex({ phaseCount: deckCount, elapsedMs: PHASE_STEP_MS * 50, outputStarted: false })).toBe(deckCount - 2);
  });
  it("jumps to the final build step when output starts", () => {
    expect(activePhaseIndex({ phaseCount: deckCount, elapsedMs: 0, outputStarted: true })).toBe(deckCount - 1);
  });
  it("lets a plain answer reach its last step via the timer", () => {
    const answerCount = PHASE_SCRIPTS.answer.length; // 2
    expect(activePhaseIndex({ phaseCount: answerCount, elapsedMs: PHASE_STEP_MS * 5, outputStarted: false, allowFinalBySim: true })).toBe(answerCount - 1);
  });
});
