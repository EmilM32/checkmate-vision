import { describe, expect, it } from "vitest"
import {
  engineReducer,
  initialEngineState,
  type BatchAnalysisItem,
} from "@/context/engine-context"

describe("engineReducer batch analysis", () => {
  const queue: BatchAnalysisItem[] = [
    {
      moveIndex: 0,
      fen: "start",
      fenBefore: "start",
    },
    {
      moveIndex: 1,
      fen: "fen-after-e4",
      fenBefore: "start",
    },
  ]

  it("starts batch with queue metadata", () => {
    const next = engineReducer(initialEngineState, {
      type: "ENGINE_BATCH_REQUEST",
      requestId: 123,
      queue,
    })

    expect(next.batch.requestId).toBe(123)
    expect(next.batch.total).toBe(2)
    expect(next.batch.completed).toBe(0)
    expect(next.batch.status).toBe("running")
  })

  it("updates progress and finishes", () => {
    const requested = engineReducer(initialEngineState, {
      type: "ENGINE_BATCH_REQUEST",
      requestId: 123,
      queue,
    })

    const progressed = engineReducer(requested, {
      type: "ENGINE_BATCH_PROGRESS",
      completed: 1,
      currentMoveIndex: 0,
    })

    expect(progressed.batch.completed).toBe(1)
    expect(progressed.batch.currentMoveIndex).toBe(0)

    const done = engineReducer(progressed, { type: "ENGINE_BATCH_DONE" })
    expect(done.batch.status).toBe("done")
    expect(done.batch.completed).toBe(done.batch.total)
  })

  it("supports cancel flow", () => {
    const requested = engineReducer(initialEngineState, {
      type: "ENGINE_BATCH_REQUEST",
      requestId: 123,
      queue,
    })

    const cancelRequested = engineReducer(requested, {
      type: "ENGINE_BATCH_CANCEL_REQUEST",
    })
    expect(cancelRequested.batch.cancelRequested).toBe(true)

    const cancelled = engineReducer(cancelRequested, {
      type: "ENGINE_BATCH_CANCELLED",
    })
    expect(cancelled.batch.status).toBe("cancelled")
    expect(cancelled.batch.cancelRequested).toBe(false)
  })

  it("reveals and conceals analysis explicitly", () => {
    const revealed = engineReducer(initialEngineState, {
      type: "ENGINE_REVEAL_ANALYSIS",
    })
    expect(revealed.guessRevealed).toBe(true)

    const concealed = engineReducer(revealed, {
      type: "ENGINE_CONCEAL_ANALYSIS",
    })
    expect(concealed.guessRevealed).toBe(false)
  })

  it("resets revealed state when starting a fresh analysis", () => {
    const revealed = engineReducer(initialEngineState, {
      type: "ENGINE_REVEAL_ANALYSIS",
    })
    expect(revealed.guessRevealed).toBe(true)

    const restarted = engineReducer(revealed, { type: "ENGINE_START_ANALYSIS" })
    expect(restarted.guessRevealed).toBe(false)
  })

  it("preserves evaluation when starting fresh analysis", () => {
    const withEval = engineReducer(initialEngineState, {
      type: "ENGINE_RESTORE_STATE",
      payload: {
        evaluation: { type: "cp", value: 150 },
        depth: 20,
        nps: 1000000,
        bestMove: "e2e4",
        pvLines: [],
        guessRevealed: false,
        batch: initialEngineState.batch,
      },
    })

    const restarted = engineReducer(withEval, { type: "ENGINE_START_ANALYSIS" })
    expect(restarted.evaluation).toEqual({ type: "cp", value: 150 })
    expect(restarted.isAnalyzing).toBe(true)
    expect(restarted.depth).toBe(0)
    expect(restarted.pvLines).toEqual([])
  })

  it("ignores low-depth evaluation updates", () => {
    const withEval = engineReducer(initialEngineState, {
      type: "ENGINE_RESTORE_STATE",
      payload: {
        evaluation: { type: "cp", value: 150 },
        depth: 20,
        nps: 0,
        bestMove: null,
        pvLines: [],
        guessRevealed: false,
        batch: initialEngineState.batch,
      },
    })

    const afterLowDepth = engineReducer(withEval, {
      type: "ENGINE_OUTPUT",
      info: {
        depth: 3,
        nps: 50000,
        multipv: 1 as const,
        score: { type: "cp", value: -200 },
        pv: ["d2d4"],
      },
    })

    expect(afterLowDepth.evaluation).toEqual({ type: "cp", value: 150 })
    expect(afterLowDepth.depth).toBe(3)
    expect(afterLowDepth.pvLines).toHaveLength(1)
  })

  it("updates evaluation at sufficient depth", () => {
    const afterHighDepth = engineReducer(initialEngineState, {
      type: "ENGINE_OUTPUT",
      info: {
        depth: 10,
        nps: 500000,
        multipv: 1 as const,
        score: { type: "cp", value: 80 },
        pv: ["e2e4", "e7e5"],
      },
    })

    expect(afterHighDepth.evaluation).toEqual({ type: "cp", value: 80 })
  })

  it("restores persisted engine snapshot", () => {
    const restored = engineReducer(initialEngineState, {
      type: "ENGINE_RESTORE_STATE",
      payload: {
        evaluation: { type: "cp", value: 45 },
        depth: 16,
        nps: 890000,
        bestMove: "e2e4",
        pvLines: [
          {
            id: 1,
            score: { type: "cp", value: 45 },
            pv: ["e2e4", "e7e5"],
          },
        ],
        guessRevealed: true,
        batch: {
          requestId: 321,
          queue: [],
          total: 0,
          completed: 0,
          currentMoveIndex: null,
          status: "done",
          cancelRequested: false,
          lastError: null,
        },
      },
    })

    expect(restored.depth).toBe(16)
    expect(restored.bestMove).toBe("e2e4")
    expect(restored.guessRevealed).toBe(true)
    expect(restored.isAnalyzing).toBe(false)
  })

  it("resets full engine state", () => {
    const dirty = engineReducer(initialEngineState, {
      type: "ENGINE_RESTORE_STATE",
      payload: {
        evaluation: { type: "cp", value: 120 },
        depth: 10,
        nps: 1000,
        bestMove: "d2d4",
        pvLines: [],
        guessRevealed: true,
        batch: {
          requestId: 2,
          queue: [],
          total: 0,
          completed: 0,
          currentMoveIndex: null,
          status: "done",
          cancelRequested: false,
          lastError: null,
        },
      },
    })

    const reset = engineReducer(dirty, { type: "ENGINE_RESET" })
    expect(reset).toEqual(initialEngineState)
  })
})
