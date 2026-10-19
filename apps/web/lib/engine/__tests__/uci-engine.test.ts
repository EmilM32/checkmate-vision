import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { FakeStockfish } from "@/lib/engine/__tests__/fake-stockfish"
import { EngineFailure, UciEngine } from "@/lib/engine/uci-engine"

const OPTIONS = { hashMb: 16, multiPv: 2, startTimeoutMs: 1_000 }
const LIMITS = { depth: 18, movetimeMs: 1_500 }
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
const BLACK_MATED =
  "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4"

async function startEngine() {
  const worker = new FakeStockfish()
  const started = UciEngine.start(() => worker, OPTIONS)
  worker.completeHandshake()
  return { worker, engine: await started }
}

describe("UciEngine", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("configures the engine during the handshake", async () => {
    const { worker } = await startEngine()

    expect(worker.commands).toEqual([
      "uci",
      "setoption name Hash value 16",
      "setoption name MultiPV value 2",
      "isready",
    ])
  })

  it("rejects when the engine never becomes ready", async () => {
    const worker = new FakeStockfish()
    const started = UciEngine.start(() => worker, OPTIONS)
    const assertion = expect(started).rejects.toMatchObject({ reason: "load" })

    vi.advanceTimersByTime(1_000)

    await assertion
    expect(worker.terminated).toBe(true)
  })

  it("rejects when the worker fails while loading", async () => {
    const worker = new FakeStockfish()
    const started = UciEngine.start(() => worker, OPTIONS)
    worker.crash("wasm fetch failed")

    await expect(started).rejects.toBeInstanceOf(EngineFailure)
    await expect(started).rejects.toMatchObject({ reason: "load" })
  })

  it("shuts down an engine that is still starting when aborted", async () => {
    const worker = new FakeStockfish()
    const controller = new AbortController()
    const started = UciEngine.start(() => worker, OPTIONS, controller.signal)

    controller.abort()

    await expect(started).rejects.toMatchObject({ reason: "terminated" })
    expect(worker.terminated).toBe(true)
  })

  it("returns line scores from White's perspective", async () => {
    const { worker, engine } = await startEngine()

    const search = engine.search(AFTER_E4, LIMITS)
    expect(worker.commands.slice(-2)).toEqual([
      `position fen ${AFTER_E4}`,
      "go depth 18 movetime 1500",
    ])
    worker.emit("info depth 18 multipv 1 score cp -30 pv e7e5")
    worker.emit("info depth 18 multipv 2 score cp -45 pv c7c5")
    worker.emit("bestmove e7e5")

    await expect(search).resolves.toEqual({
      scores: {
        1: { type: "cp", value: 30 },
        2: { type: "cp", value: 45 },
        3: null,
      },
    })
  })

  it("answers positions without legal moves without the engine", async () => {
    const { worker, engine } = await startEngine()
    const commandCount = worker.commands.length

    await expect(engine.search(BLACK_MATED, LIMITS)).resolves.toEqual({
      scores: { 1: { type: "mate", value: 0 }, 2: null, 3: null },
    })
    expect(worker.commands).toHaveLength(commandCount)
  })

  it("stops a search, which still resolves with what it found", async () => {
    const { worker, engine } = await startEngine()

    const search = engine.search(AFTER_E4, LIMITS)
    worker.emit("info depth 9 multipv 1 score cp -20 pv e7e5")
    engine.stop()
    expect(worker.commands.at(-1)).toBe("stop")
    worker.emit("bestmove e7e5")

    await expect(search).resolves.toMatchObject({
      scores: { 1: { type: "cp", value: 20 } },
    })
  })

  it("rejects the running search when the worker crashes", async () => {
    const { worker, engine } = await startEngine()

    const search = engine.search(AFTER_E4, LIMITS)
    worker.crash("RuntimeError: unreachable")

    await expect(search).rejects.toMatchObject({ reason: "crash" })
    expect(worker.terminated).toBe(true)
    await expect(engine.search(AFTER_E4, LIMITS)).rejects.toMatchObject({
      reason: "crash",
    })
  })
})
