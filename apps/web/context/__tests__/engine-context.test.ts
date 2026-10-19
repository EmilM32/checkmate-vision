import { describe, expect, it } from "vitest"
import {
  engineReducer,
  initialEngineState,
  type PersistableEngineState,
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
    const withEval = {
      ...initialEngineState,
      evaluation: { type: "cp", value: 150 } as const,
      depth: 20,
    }

    const restarted = engineReducer(withEval, { type: "ENGINE_START_ANALYSIS" })
    expect(restarted.evaluation).toEqual({ type: "cp", value: 150 })
    expect(restarted.isAnalyzing).toBe(true)
    expect(restarted.depth).toBe(0)
    expect(restarted.pvLines).toEqual([])
  })

  it("ignores low-depth evaluation updates", () => {
    const withEval = {
      ...initialEngineState,
      evaluation: { type: "cp", value: 150 } as const,
      depth: 20,
    }

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

  it("restores only the guess reveal from a persisted snapshot", () => {
    // Sessions saved by earlier versions also contain engine output.
    const legacyPayload = {
      guessRevealed: true,
      evaluation: { type: "cp", value: 45 },
      bestMove: "e2e4",
      batch: { ...initialEngineState.batch, requestId: 321, status: "running" },
    }

    const restored = engineReducer(initialEngineState, {
      type: "ENGINE_RESTORE_STATE",
      payload: legacyPayload as PersistableEngineState,
    })

    expect(restored.guessRevealed).toBe(true)
    expect(restored.evaluation).toBeNull()
    expect(restored.bestMove).toBeNull()
    expect(restored.batch).toEqual(initialEngineState.batch)
    expect(restored.isAnalyzing).toBe(false)
  })

  it("resets engine state but keeps the last failure visible", () => {
    const dirty = {
      ...initialEngineState,
      evaluation: { type: "cp", value: 120 } as const,
      bestMove: "d2d4",
      guessRevealed: true,
      error: "errors.engineCrashed",
    }

    const reset = engineReducer(dirty, { type: "ENGINE_RESET" })
    expect(reset).toEqual({
      ...initialEngineState,
      error: "errors.engineCrashed",
    })
  })

  it("clears the failure once the engine is ready", () => {
    const failed = engineReducer(initialEngineState, {
      type: "ENGINE_ERROR",
      error: "errors.engineLoadFailed",
    })
    const retrying = engineReducer(failed, { type: "ENGINE_RETRY_REQUEST" })
    expect(retrying.retryRequested).toBe(true)

    const ready = engineReducer(retrying, { type: "ENGINE_READY" })
    expect(ready.error).toBeNull()
    expect(ready.retryRequested).toBe(false)
  })
})
