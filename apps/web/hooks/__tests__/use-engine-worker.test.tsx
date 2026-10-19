import React from "react"
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EngineProvider, useEngineContext } from "@/context/engine-context"
import { GameProvider, useGameContext } from "@/context/game-context"
import { useEngineWorker } from "@/hooks/use-engine-worker"

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
const AFTER_E4_FEN =
  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
const BLACK_CHECKMATED_FEN =
  "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4"

class FakeStockfish {
  static instances: FakeStockfish[] = []

  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  commands: string[] = []

  constructor() {
    FakeStockfish.instances.push(this)
  }

  postMessage(command: string) {
    this.commands.push(command)
  }

  terminate() {}

  emit(line: string) {
    this.onmessage?.(new MessageEvent("message", { data: line }))
  }
}

function renderEngineHarness() {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <GameProvider>
      <EngineProvider>{children}</EngineProvider>
    </GameProvider>
  )

  const { result } = renderHook(
    () => ({
      worker: useEngineWorker(),
      game: useGameContext(),
      engine: useEngineContext(),
    }),
    { wrapper }
  )

  return {
    get current() {
      return result.current
    },
    get stockfish() {
      const instance = FakeStockfish.instances.at(-1)
      if (!instance) throw new Error("worker not started")
      return instance
    },
  }
}

function emit(harness: ReturnType<typeof renderEngineHarness>, line: string) {
  act(() => {
    harness.stockfish.emit(line)
  })
}

function flushTimers() {
  act(() => {
    vi.advanceTimersByTime(500)
  })
}

function lastCommands(
  harness: ReturnType<typeof renderEngineHarness>,
  count = 2
) {
  return harness.stockfish.commands.slice(-count)
}

// Plays 1.e4 and lets the live searches for both positions finish.
function playE4WithLiveAnalysis(
  harness: ReturnType<typeof renderEngineHarness>
) {
  emit(harness, "info depth 12 multipv 1 score cp 30 pv e2e4")
  act(() => {
    harness.current.game.makeMove("e2", "e4")
  })
  flushTimers()
  emit(harness, "bestmove e2e4")
  emit(harness, "info depth 12 multipv 1 score cp -35 pv e7e5")
  emit(harness, "bestmove e7e5")
}

function requestGameAnalysis(harness: ReturnType<typeof renderEngineHarness>) {
  act(() => {
    harness.current.engine.dispatch({
      type: "ENGINE_BATCH_REQUEST",
      requestId: 1,
      queue: [
        { moveIndex: 0, fen: START_FEN, fenBefore: START_FEN },
        { moveIndex: 1, fen: AFTER_E4_FEN, fenBefore: START_FEN },
      ],
    })
  })
}

function startEngine(harness: ReturnType<typeof renderEngineHarness>) {
  act(() => {
    harness.current.worker.start()
  })
  emit(harness, "uciok")
  emit(harness, "readyok")
}

describe("useEngineWorker", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeStockfish.instances = []
    vi.stubGlobal("Worker", FakeStockfish)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("analyzes the current position once the engine is ready", () => {
    const harness = renderEngineHarness()
    startEngine(harness)

    expect(harness.stockfish.commands).toContain(`position fen ${START_FEN}`)
    expect(harness.current.engine.state.isAnalyzing).toBe(true)
  })

  it("stores scores from white's perspective when black is to move", () => {
    const harness = renderEngineHarness()
    startEngine(harness)

    act(() => {
      harness.current.game.setPositionFromFen(AFTER_E4_FEN)
    })
    flushTimers()
    emit(harness, "bestmove e2e4")

    expect(harness.stockfish.commands.at(-2)).toBe(
      `position fen ${AFTER_E4_FEN}`
    )

    emit(harness, "info depth 12 multipv 1 score cp -40 pv e7e5")
    emit(harness, "info depth 12 multipv 2 score mate 3 pv d7d5")

    const { state } = harness.current.engine
    expect(state.evaluation).toEqual({ type: "cp", value: 40 })
    expect(state.pvLines).toEqual([
      { id: 1, score: { type: "cp", value: 40 }, pv: ["e7e5"] },
      { id: 2, score: { type: "mate", value: -3 }, pv: ["d7d5"] },
    ])
  })

  it("does not hang on a checkmated position", () => {
    const harness = renderEngineHarness()
    startEngine(harness)

    act(() => {
      harness.current.game.setPositionFromFen(BLACK_CHECKMATED_FEN)
    })
    flushTimers()
    emit(harness, "bestmove e2e4")
    flushTimers()

    expect(harness.stockfish.commands).not.toContain(
      `position fen ${BLACK_CHECKMATED_FEN}`
    )
    expect(harness.current.engine.state.isAnalyzing).toBe(false)
    expect(harness.current.engine.state.evaluation).toEqual({
      type: "mate",
      value: 0,
    })

    const commandCount = harness.stockfish.commands.length
    act(() => {
      harness.current.game.setPositionFromFen(START_FEN)
    })
    flushTimers()

    // The engine is idle, so the next position starts without a stop/bestmove
    // round-trip.
    expect(harness.stockfish.commands.slice(commandCount)).toEqual([
      `position fen ${START_FEN}`,
      "go depth 20 multipv 3",
    ])
  })

  it("recovers when stockfish reports bestmove (none)", () => {
    const harness = renderEngineHarness()
    startEngine(harness)

    emit(harness, "bestmove (none)")

    expect(harness.current.engine.state.isAnalyzing).toBe(false)
  })

  it("classifies a move only from the search of the resulting position", () => {
    const harness = renderEngineHarness()
    startEngine(harness)

    emit(harness, "info depth 12 multipv 1 score cp 30 pv e2e4")
    act(() => {
      harness.current.game.makeMove("e2", "e4")
    })
    flushTimers()

    // The interrupted search of the starting position finishes first.
    emit(harness, "bestmove e2e4")
    expect(harness.current.game.state.history[0]?.classification).toBeNull()

    emit(harness, "info depth 12 multipv 1 score cp -35 pv e7e5")
    emit(harness, "info depth 12 multipv 2 score cp -50 pv c7c5")
    emit(harness, "bestmove e7e5")

    expect(harness.current.game.state.history[0]).toMatchObject({
      scoreBefore: { type: "cp", value: 30 },
      scoreAfter: { type: "cp", value: 35 },
      classification: "best",
    })
  })

  describe("game analysis", () => {
    it("does not overwrite the live view and resumes it when done", () => {
      const harness = renderEngineHarness()
      startEngine(harness)
      playE4WithLiveAnalysis(harness)

      const liveLines = harness.current.engine.state.pvLines
      expect(harness.current.engine.state.evaluation).toEqual({
        type: "cp",
        value: 35,
      })

      requestGameAnalysis(harness)
      expect(lastCommands(harness)).toEqual([
        `position fen ${START_FEN}`,
        "go depth 20 multipv 3",
      ])

      emit(harness, "info depth 12 multipv 1 score cp 90 pv d2d4")
      emit(harness, "bestmove d2d4")
      emit(harness, "info depth 12 multipv 1 score cp -10 pv c7c5")

      expect(harness.current.engine.state.evaluation).toEqual({
        type: "cp",
        value: 35,
      })
      expect(harness.current.engine.state.pvLines).toBe(liveLines)
      expect(harness.current.engine.state.isAnalyzing).toBe(false)

      emit(harness, "bestmove c7c5")

      expect(harness.current.engine.state.batch.status).toBe("done")
      expect(harness.current.game.state.history[0]).toMatchObject({
        scoreBefore: { type: "cp", value: 90 },
        scoreAfter: { type: "cp", value: 10 },
      })
      expect(lastCommands(harness)).toEqual([
        `position fen ${AFTER_E4_FEN}`,
        "go depth 20 multipv 3",
      ])
      expect(harness.current.engine.state.isAnalyzing).toBe(true)
    })

    it("resumes live analysis of the current position after cancel", () => {
      const harness = renderEngineHarness()
      startEngine(harness)
      playE4WithLiveAnalysis(harness)
      requestGameAnalysis(harness)

      act(() => {
        harness.current.engine.dispatch({ type: "ENGINE_BATCH_CANCEL_REQUEST" })
      })
      expect(lastCommands(harness, 1)).toEqual(["stop"])

      act(() => {
        harness.current.game.goToMove(0)
      })
      emit(harness, "bestmove d2d4")

      expect(harness.current.engine.state.batch.status).toBe("cancelled")
      expect(lastCommands(harness)).toEqual([
        `position fen ${START_FEN}`,
        "go depth 20 multipv 3",
      ])
    })

    it("clears stale live lines and skips moves replaced during the batch", () => {
      const harness = renderEngineHarness()
      startEngine(harness)
      playE4WithLiveAnalysis(harness)
      requestGameAnalysis(harness)

      act(() => {
        harness.current.game.goToMove(0)
      })
      act(() => {
        harness.current.game.makeMove("d2", "d4")
      })
      flushTimers()

      expect(harness.current.engine.state.evaluation).toBeNull()
      expect(harness.current.engine.state.pvLines).toEqual([])

      emit(harness, "info depth 12 multipv 1 score cp 30 pv e2e4")
      emit(harness, "bestmove e2e4")
      emit(harness, "info depth 12 multipv 1 score cp -35 pv e7e5")
      emit(harness, "bestmove e7e5")

      expect(harness.current.game.state.history).toHaveLength(1)
      expect(harness.current.game.state.history[0]).toMatchObject({
        san: "d4",
        scoreAfter: null,
        classification: null,
      })
      expect(lastCommands(harness, 2)[0]).toBe(
        `position fen ${harness.current.game.state.fen}`
      )
    })
  })
})
