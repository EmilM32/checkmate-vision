import { describe, expect, it, vi } from "vitest"

import type { BatchAnalysisItem } from "@/context/engine-context"
import {
  analyzeGamePositions,
  getGameAnalysisConcurrency,
} from "@/lib/engine/game-analysis"
import {
  EngineFailure,
  type SearchResult,
  type UciEngine,
} from "@/lib/engine/uci-engine"

const LIMITS = { depth: 18, movetimeMs: 1_500 }

function items(count: number): BatchAnalysisItem[] {
  return Array.from({ length: count }, (_, moveIndex) => ({
    moveIndex,
    fen: `fen-${moveIndex}`,
    fenBefore: `fen-${Math.max(0, moveIndex - 1)}`,
  }))
}

function result(value: number): SearchResult {
  return { scores: { 1: { type: "cp", value }, 2: null, 3: null } }
}

/** Engines whose searches the test finishes explicitly. */
function createEnginePool() {
  const searches: {
    fen: string
    resolve: (result: SearchResult) => void
    reject: (error: Error) => void
  }[] = []
  const engines: {
    stop: ReturnType<typeof vi.fn>
    terminate: ReturnType<typeof vi.fn>
  }[] = []

  const startEngine = async () => {
    const engine = {
      search: (fen: string) =>
        new Promise<SearchResult>((resolve, reject) => {
          searches.push({ fen, resolve, reject })
        }),
      stop: vi.fn(),
      terminate: vi.fn(),
    }
    engines.push(engine)
    return engine as unknown as UciEngine
  }

  return { searches, engines, startEngine }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("getGameAnalysisConcurrency", () => {
  it("leaves a core for the live engine and caps the pool", () => {
    expect(getGameAnalysisConcurrency(8)).toBe(4)
    expect(getGameAnalysisConcurrency(4)).toBe(3)
    expect(getGameAnalysisConcurrency(2)).toBe(1)
    expect(getGameAnalysisConcurrency(1)).toBe(1)
    expect(getGameAnalysisConcurrency(undefined)).toBe(1)
  })
})

describe("analyzeGamePositions", () => {
  it("runs positions in parallel and reports them as they finish", async () => {
    const pool = createEnginePool()
    const reported: number[] = []

    const run = analyzeGamePositions({
      items: items(4),
      concurrency: 2,
      limits: LIMITS,
      startEngine: pool.startEngine,
      signal: new AbortController().signal,
      onPosition: (item) => reported.push(item.moveIndex),
    })
    await flush()

    // Two engines, each busy with one position.
    expect(pool.searches.map((search) => search.fen)).toEqual([
      "fen-0",
      "fen-1",
    ])

    pool.searches[1]!.resolve(result(10))
    await flush()
    expect(reported).toEqual([1])
    expect(pool.searches[2]!.fen).toBe("fen-2")

    pool.searches[0]!.resolve(result(20))
    pool.searches[2]!.resolve(result(30))
    await flush()
    pool.searches[3]!.resolve(result(40))

    await run
    expect(reported).toEqual([1, 0, 2, 3])
    expect(
      pool.engines.every((engine) => engine.terminate.mock.calls.length === 1)
    ).toBe(true)
  })

  it("does not start more engines than positions", async () => {
    const pool = createEnginePool()

    const run = analyzeGamePositions({
      items: items(1),
      concurrency: 4,
      limits: LIMITS,
      startEngine: pool.startEngine,
      signal: new AbortController().signal,
      onPosition: () => {},
    })
    await flush()
    pool.searches[0]!.resolve(result(0))
    await run

    expect(pool.engines).toHaveLength(1)
  })

  it("stops the engines and resolves when aborted", async () => {
    const pool = createEnginePool()
    const controller = new AbortController()
    const onPosition = vi.fn()

    const run = analyzeGamePositions({
      items: items(5),
      concurrency: 2,
      limits: LIMITS,
      startEngine: pool.startEngine,
      signal: controller.signal,
      onPosition,
    })
    await flush()

    controller.abort()
    expect(
      pool.engines.every((engine) => engine.stop.mock.calls.length === 1)
    ).toBe(true)
    // Stopped searches still finish, but nothing more is reported or started.
    pool.searches.forEach((search) => search.resolve(result(0)))

    await expect(run).resolves.toBeUndefined()
    expect(onPosition).not.toHaveBeenCalled()
    expect(pool.searches).toHaveLength(2)
    expect(
      pool.engines.every((engine) => engine.terminate.mock.calls.length === 1)
    ).toBe(true)
  })

  it("rejects when an engine fails and shuts the others down", async () => {
    const pool = createEnginePool()

    const run = analyzeGamePositions({
      items: items(4),
      concurrency: 2,
      limits: LIMITS,
      startEngine: pool.startEngine,
      signal: new AbortController().signal,
      onPosition: () => {},
    })
    await flush()

    pool.searches[0]!.reject(new EngineFailure("crash"))

    await expect(run).rejects.toMatchObject({ reason: "crash" })
    expect(
      pool.engines.every((engine) => engine.terminate.mock.calls.length === 1)
    ).toBe(true)
  })
})
