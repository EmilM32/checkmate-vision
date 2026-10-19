import type { EngineScore } from "@/context/engine-context"
import { getTerminalScore } from "@/lib/chess/move-analysis"
import { getSideToMove, toWhitePerspective } from "@/lib/engine/eval"
import { parseBestMoveLine, parseInfoLine } from "@/lib/engine/parser"
import { serializeCommand } from "@/lib/engine/worker"

export type LineScores = { 1: EngineScore; 2: EngineScore; 3: EngineScore }

export type SearchLimits = { depth: number; movetimeMs: number }

export type SearchResult = {
  // Scores per multi-PV line, from White's perspective.
  scores: LineScores
}

export type UciEngineOptions = {
  hashMb: number
  multiPv: number
  startTimeoutMs: number
}

// The subset of Worker used here, so tests can pass a fake.
export type EngineWorker = {
  postMessage(message: string): void
  terminate(): void
  onmessage: ((event: MessageEvent) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
}

export class EngineFailure extends Error {
  constructor(readonly reason: "load" | "crash" | "terminated") {
    super(`Stockfish engine ${reason}`)
  }
}

type PendingSearch = {
  fen: string
  scores: LineScores
  resolve: (result: SearchResult) => void
  reject: (error: Error) => void
}

/**
 * One Stockfish worker driven through promises: `UciEngine.start` resolves
 * once the engine is ready, `search` resolves with the final line scores.
 * One search runs at a time; callers queue work themselves.
 */
export class UciEngine {
  private pending: PendingSearch | null = null
  private failure: EngineFailure | null = null
  // Set while starting: receives the handshake lines.
  private onLine: ((line: string) => void) | null = null
  private startFailure: ((error: EngineFailure) => void) | null = null

  private constructor(private readonly worker: EngineWorker) {
    worker.onmessage = (event) => this.handleLine(String(event.data))
    worker.onerror = (event) => {
      event.preventDefault?.()
      this.fail(new EngineFailure(this.onLine ? "load" : "crash"))
    }
  }

  static start(
    createWorker: () => EngineWorker,
    { hashMb, multiPv, startTimeoutMs }: UciEngineOptions,
    signal?: AbortSignal
  ): Promise<UciEngine> {
    if (signal?.aborted) {
      return Promise.reject(new EngineFailure("terminated"))
    }

    let engine: UciEngine
    try {
      engine = new UciEngine(createWorker())
    } catch {
      return Promise.reject(new EngineFailure("load"))
    }

    return new Promise<UciEngine>((resolve, reject) => {
      const timeout = setTimeout(() => {
        engine.fail(new EngineFailure("load"))
      }, startTimeoutMs)
      const abort = () => engine.fail(new EngineFailure("terminated"))
      signal?.addEventListener("abort", abort)

      engine.startFailure = (error) => {
        clearTimeout(timeout)
        signal?.removeEventListener("abort", abort)
        reject(error)
      }
      engine.onLine = (line) => {
        if (line === "uciok") {
          engine.send({ type: "setoption", name: "Hash", value: hashMb })
          engine.send({ type: "setoption", name: "MultiPV", value: multiPv })
          engine.send({ type: "isready" })
        } else if (line === "readyok") {
          clearTimeout(timeout)
          signal?.removeEventListener("abort", abort)
          engine.onLine = null
          engine.startFailure = null
          resolve(engine)
        }
      }
      engine.send({ type: "uci" })
    })
  }

  search(fen: string, limits: SearchLimits): Promise<SearchResult> {
    if (this.failure) return Promise.reject(this.failure)
    if (this.pending) {
      return Promise.reject(new Error("UciEngine runs one search at a time"))
    }

    const terminalScore = getTerminalScore(fen)
    if (terminalScore) {
      return Promise.resolve({ scores: { 1: terminalScore, 2: null, 3: null } })
    }

    return new Promise<SearchResult>((resolve, reject) => {
      this.pending = {
        fen,
        scores: { 1: null, 2: null, 3: null },
        resolve,
        reject,
      }
      this.send({ type: "position", fen })
      this.send({
        type: "go",
        depth: limits.depth,
        movetimeMs: limits.movetimeMs,
      })
    })
  }

  /** Ends the running search early; it still resolves with what it found. */
  stop() {
    if (this.pending) this.send({ type: "stop" })
  }

  terminate() {
    this.fail(new EngineFailure("terminated"))
  }

  private send(command: Parameters<typeof serializeCommand>[0]) {
    this.worker.postMessage(serializeCommand(command))
  }

  private handleLine(line: string) {
    if (this.onLine) {
      this.onLine(line)
      return
    }

    const pending = this.pending
    if (!pending) return

    const info = parseInfoLine(line)
    if (info) {
      pending.scores[info.multipv] = toWhitePerspective(
        info.score,
        getSideToMove(pending.fen)
      )
      return
    }

    if (parseBestMoveLine(line)) {
      this.pending = null
      pending.resolve({ scores: pending.scores })
    }
  }

  // Any failure ends the worker: a crashed or unresponsive engine is unusable.
  private fail(error: EngineFailure) {
    if (this.failure) return
    this.failure = error
    this.worker.terminate()
    this.startFailure?.(error)
    this.startFailure = null
    this.pending?.reject(error)
    this.pending = null
  }
}
