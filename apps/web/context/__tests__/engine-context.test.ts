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
})
