import React from "react"
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  EngineProvider,
  useEngineContext,
  type BatchAnalysisItem,
} from "@/context/engine-context"
import { GameProvider, useGameContext } from "@/context/game-context"
import { useGameAnalysis } from "@/hooks/use-game-analysis"
import { analysisCache } from "@/lib/engine/analysis-cache"
import { FakeStockfish } from "@/lib/engine/__tests__/fake-stockfish"
import { parsePgn } from "@/lib/chess/fen-pgn"

let workers: FakeStockfish[] = []

function renderGameAnalysis() {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <GameProvider>
      <EngineProvider>{children}</EngineProvider>
    </GameProvider>
  )
  const { result } = renderHook(
    () => {
      useGameAnalysis()
      return { game: useGameContext(), engine: useEngineContext() }
    },
    { wrapper }
  )
  return result
}

type Harness = ReturnType<typeof renderGameAnalysis>

function loadGame(result: Harness, pgn: string): BatchAnalysisItem[] {
  const parsed = parsePgn(pgn)
  if (!parsed.ok) throw new Error(parsed.error)
  act(() => {
    result.current.game.loadPgnGame(parsed.data)
  })
  const { initialFen, history } = result.current.game.state
  return [
    { moveIndex: 0, fen: initialFen, fenBefore: initialFen },
    ...history.map((move, index) => ({
      moveIndex: index + 1,
      fen: move.fen,
      fenBefore: index === 0 ? initialFen : history[index - 1]!.fen,
    })),
  ]
}

function requestAnalysis(result: Harness, queue: BatchAnalysisItem[]) {
  act(() => {
    result.current.engine.dispatch({
      type: "ENGINE_BATCH_REQUEST",
      requestId: 1,
      queue,
    })
  })
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function startWorkers() {
  for (const worker of workers) {
    act(() => worker.completeHandshake())
  }
  await settle()
}

/** Finishes the search a worker is running with a best-line score. */
async function answer(worker: FakeStockfish, line: string) {
  act(() => {
    worker.emit(`info depth 18 multipv 1 score ${line} pv a2a3`)
    worker.emit("bestmove a2a3")
  })
  await settle()
}

function workerAnalyzing(fen: string) {
  const worker = workers.find((w) => w.lastPosition === fen && !w.terminated)
  if (!worker) throw new Error(`no worker on ${fen}`)
  return worker
}

describe("useGameAnalysis", () => {
  beforeEach(() => {
    analysisCache.clear()
    workers = []
    vi.stubGlobal(
      "Worker",
      class extends FakeStockfish {
        constructor() {
          super()
          workers.push(this)
        }
      }
    )
    vi.stubGlobal("navigator", { hardwareConcurrency: 3 })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("analyses a game with a pool of workers and classifies each move", async () => {
    const result = renderGameAnalysis()
    const queue = loadGame(result, "1. e4 e5")
    requestAnalysis(result, queue)

    // 3 cores: two game workers, one core left for the live engine.
    expect(workers).toHaveLength(2)
    await startWorkers()

    const [start, afterE4, afterE5] = queue.map((item) => item.fen)
    // Positions finish out of order; a move is classified once the
    // positions on both sides of it are known.
    await answer(workerAnalyzing(afterE4!), "cp -30")
    expect(result.current.game.state.history[0]?.classification).toBeNull()

    await answer(workerAnalyzing(start!), "cp 35")
    expect(result.current.game.state.history[0]).toMatchObject({
      scoreBefore: { type: "cp", value: 35 },
      scoreAfter: { type: "cp", value: 30 },
      classification: "best",
    })

    // Black's reply hands White a large advantage.
    await answer(workerAnalyzing(afterE5!), "cp 400")
    expect(result.current.game.state.history[1]?.classification).toBe("blunder")

    expect(result.current.engine.state.batch).toMatchObject({
      status: "done",
      completed: 3,
    })
    expect(workers.every((worker) => worker.terminated)).toBe(true)
    // The live analysis state is untouched by game analysis.
    expect(result.current.engine.state.evaluation).toBeNull()
    // Results are kept for the live view while browsing the game.
    expect(analysisCache.get(afterE5!)).toMatchObject({
      depth: 18,
      complete: false,
    })
  })

  it("cancels a running analysis", async () => {
    const result = renderGameAnalysis()
    requestAnalysis(result, loadGame(result, "1. e4 e5 2. Nf3"))
    await startWorkers()

    act(() => {
      result.current.engine.dispatch({ type: "ENGINE_BATCH_CANCEL_REQUEST" })
    })
    for (const worker of workers) {
      expect(worker.commands.at(-1)).toBe("stop")
      act(() => worker.emit("bestmove a2a3"))
    }
    await settle()

    expect(result.current.engine.state.batch.status).toBe("cancelled")
    expect(workers.every((worker) => worker.terminated)).toBe(true)
  })

  it("reports an engine failure", async () => {
    const result = renderGameAnalysis()
    requestAnalysis(result, loadGame(result, "1. e4 e5"))
    act(() => workers[0]!.crash("wasm fetch failed"))
    await settle()

    expect(result.current.engine.state.batch).toMatchObject({
      status: "error",
      lastError: "errors.engineLoadFailed",
    })
    expect(workers.every((worker) => worker.terminated)).toBe(true)
  })

  it("stops when the game analysis is cleared", async () => {
    const result = renderGameAnalysis()
    requestAnalysis(result, loadGame(result, "1. e4 e5"))
    await startWorkers()

    act(() => {
      result.current.engine.dispatch({ type: "ENGINE_BATCH_CLEAR" })
    })
    for (const worker of workers) {
      act(() => worker.emit("bestmove a2a3"))
    }
    await settle()

    expect(workers.every((worker) => worker.terminated)).toBe(true)
    expect(result.current.engine.state.batch.status).toBe("idle")
  })
})
