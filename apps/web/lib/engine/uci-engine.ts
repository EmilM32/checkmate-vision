import type { EngineLine, EngineScore } from "@/context/engine-context"
import { getTerminalScore } from "@/lib/chess/move-analysis"
import { getSideToMove, toWhitePerspective } from "@/lib/engine/eval"
import { parseBestMoveLine, parseInfoLine } from "@/lib/engine/parser"
import type { ParsedInfoLine } from "@/lib/engine/types"
import { serializeCommand } from "@/lib/engine/worker"

export type LineScores = { 1: EngineScore; 2: EngineScore; 3: EngineScore }

export type SearchLimits = {
  depth: number
  movetimeMs?: number
  nodes?: number
  // Clear the hash first: results then depend only on the position and
  // the limits, not on what this engine searched before.
  fresh?: boolean
  // Wall-clock limit for a `go` that never answers. The search is rejected
  // and the worker is replaced on the next search.
  goTimeoutMs?: number
}

export type SearchResult = {
  // Scores per multi-PV line, from White's perspective.
  scores: LineScores
  // The deepest completed lines, best first; empty for terminal positions.
  lines: EngineLine[]
  depth: number
}

export type SearchHandlers = {
  onInfo?: (info: ParsedInfoLine) => void
  // The replacement worker finished its handshake. Called before `go`.
  onReady?: () => void
  onDone?: (result: SearchResult) => void
  onError?: (error: EngineFailure) => void
}

export type EngineHooks = {
  onReady?: (engine: UciEngine) => void
  onFailure?: (error: EngineFailure) => void
}

export type UciEngineOptions = {
  hashMb: number
  multiPv: number
  startTimeoutMs: number
}

// A search that never sends bestmove. Longer than a live movetime and a
// game-analysis node budget, so a busy engine is not cut off.
const GO_TIMEOUT_MS = 60_000

// The subset of Worker used here, so tests can pass a fake.
export type EngineWorker = {
  postMessage(message: string): void
  terminate(): void
  onmessage: ((event: MessageEvent) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
}

export class EngineFailure extends Error {
  constructor(readonly reason: "load" | "crash" | "terminated" | "timeout") {
    super(`Stockfish engine ${reason}`)
  }
}

type PendingSearch = {
  fen: string
  scores: LineScores
  lines: Map<1 | 2 | 3, EngineLine>
  depth: number
  resolve: (result: SearchResult) => void
  reject: (error: Error) => void
  onInfo?: SearchHandlers["onInfo"]
  onDone?: SearchHandlers["onDone"]
  onError?: SearchHandlers["onError"]
}

type WaitingSearch = {
  fen: string
  limits: SearchLimits
  handlers?: SearchHandlers
  resolve: (result: SearchResult) => void
  reject: (error: Error) => void
}

/**
 * One Stockfish worker driven through promises: `UciEngine.start` resolves
 * once the engine is ready, `search` resolves with the final line scores.
 * One search runs at a time; callers queue work themselves. After a crash
 * or a `go` that never answers, the next `search` builds a new worker.
 */
export class UciEngine {
  private worker: EngineWorker
  private pending: PendingSearch | null = null
  private failure: EngineFailure | null = null
  private stopped = false
  private booting = false
  private hasBeenReady = false
  // Set while starting: receives the handshake lines.
  private onLine: ((line: string) => void) | null = null
  private bootReject: ((error: EngineFailure) => void) | null = null
  private handshakeTimer: ReturnType<typeof setTimeout> | null = null
  private goTimer: ReturnType<typeof setTimeout> | null = null
  private hooks: EngineHooks | null = null
  private waiting: WaitingSearch | null = null

  private constructor(
    worker: EngineWorker,
    private readonly createWorker: () => EngineWorker,
    private readonly options: UciEngineOptions
  ) {
    this.worker = worker
    this.attach(worker)
  }

  static start(
    createWorker: () => EngineWorker,
    options: UciEngineOptions,
    signal?: AbortSignal,
    hooks?: EngineHooks
  ): Promise<UciEngine> {
    if (signal?.aborted) {
      return Promise.reject(new EngineFailure("terminated"))
    }

    let engine: UciEngine
    try {
      engine = new UciEngine(createWorker(), createWorker, options)
    } catch {
      return Promise.reject(new EngineFailure("load"))
    }
    engine.hooks = hooks ?? null

    const abort = () => engine.fail(new EngineFailure("terminated"))
    signal?.addEventListener("abort", abort)
    return engine.handshake().then(
      () => {
        signal?.removeEventListener("abort", abort)
        return engine
      },
      (error: unknown) => {
        signal?.removeEventListener("abort", abort)
        throw error
      }
    )
  }

  search(
    fen: string,
    limits: SearchLimits,
    handlers?: SearchHandlers
  ): Promise<SearchResult> {
    if (this.stopped) return Promise.reject(new EngineFailure("terminated"))
    if (this.pending || this.booting) {
      return Promise.reject(new Error("UciEngine runs one search at a time"))
    }
    if (!this.failure) return this.beginSearch(fen, limits, handlers)

    return new Promise<SearchResult>((resolve, reject) => {
      this.booting = true
      this.waiting = { fen, limits, handlers, resolve, reject }
      void this.reboot().catch(() => {})
    })
  }

  /** Ends the running search early; it still resolves with what it found. */
  stop() {
    if (this.pending) {
      this.send({ type: "stop" })
      return
    }
    // The replacement worker is still handshaking. Drop it so the caller
    // can search the next position, which builds another worker.
    if (this.booting) this.fail(new EngineFailure("crash"))
  }

  terminate() {
    this.stopped = true
    this.fail(new EngineFailure("terminated"))
  }

  private reboot(): Promise<void> {
    this.failure = null
    let worker: EngineWorker
    try {
      worker = this.createWorker()
    } catch {
      const error = new EngineFailure(this.hasBeenReady ? "crash" : "load")
      this.fail(error)
      return Promise.reject(error)
    }
    this.attach(worker)
    return this.handshake()
  }

  private handshake(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.clearHandshakeTimer()
      this.handshakeTimer = setTimeout(() => {
        this.fail(new EngineFailure(this.hasBeenReady ? "crash" : "load"))
      }, this.options.startTimeoutMs)
      this.bootReject = (error) => {
        this.clearHandshakeTimer()
        this.bootReject = null
        reject(error)
      }
      this.onLine = (line) => {
        if (line === "uciok") {
          this.send({
            type: "setoption",
            name: "Hash",
            value: this.options.hashMb,
          })
          this.send({
            type: "setoption",
            name: "MultiPV",
            value: this.options.multiPv,
          })
          this.send({ type: "isready" })
        } else if (line === "readyok") {
          this.clearHandshakeTimer()
          this.onLine = null
          this.bootReject = null
          this.hasBeenReady = true
          this.booting = false
          const waiting = this.waiting
          this.waiting = null
          this.hooks?.onReady?.(this)
          if (waiting && !this.stopped && !this.failure) {
            waiting.handlers?.onReady?.()
            void this.beginSearch(
              waiting.fen,
              waiting.limits,
              waiting.handlers
            ).then(waiting.resolve, waiting.reject)
          }
          if (this.stopped || this.failure) {
            reject(this.failure ?? new EngineFailure("terminated"))
          } else {
            resolve()
          }
        }
      }
      this.send({ type: "uci" })
    })
  }

  private beginSearch(
    fen: string,
    limits: SearchLimits,
    handlers?: SearchHandlers
  ): Promise<SearchResult> {
    if (this.failure) return Promise.reject(this.failure)

    const terminalScore = getTerminalScore(fen)
    if (terminalScore) {
      const result: SearchResult = {
        scores: { 1: terminalScore, 2: null, 3: null },
        lines: [],
        depth: 0,
      }
      handlers?.onDone?.(result)
      return Promise.resolve(result)
    }

    return new Promise<SearchResult>((resolve, reject) => {
      this.pending = {
        fen,
        scores: { 1: null, 2: null, 3: null },
        lines: new Map(),
        depth: 0,
        resolve,
        reject,
        onInfo: handlers?.onInfo,
        onDone: handlers?.onDone,
        onError: handlers?.onError,
      }
      this.clearGoTimer()
      this.goTimer = setTimeout(() => {
        this.fail(new EngineFailure("timeout"))
      }, limits.goTimeoutMs ?? GO_TIMEOUT_MS)
      if (limits.fresh) this.send({ type: "ucinewgame" })
      this.send({ type: "position", fen })
      this.send({
        type: "go",
        depth: limits.depth,
        movetimeMs: limits.movetimeMs,
        nodes: limits.nodes,
      })
    })
  }

  private attach(worker: EngineWorker) {
    this.worker = worker
    worker.onmessage = (event) => this.handleLine(String(event.data))
    worker.onerror = (event) => {
      event.preventDefault?.()
      this.fail(new EngineFailure(this.hasBeenReady ? "crash" : "load"))
    }
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
    if (!pending || this.failure) return

    const info = parseInfoLine(line)
    if (info) {
      const score = toWhitePerspective(info.score, getSideToMove(pending.fen))
      pending.scores[info.multipv] = score
      pending.lines.set(info.multipv, { id: info.multipv, score, pv: info.pv })
      pending.depth = Math.max(pending.depth, info.depth)
      pending.onInfo?.({ ...info, score })
      return
    }

    if (parseBestMoveLine(line)) {
      this.clearGoTimer()
      this.pending = null
      const result: SearchResult = {
        scores: pending.scores,
        lines: [...pending.lines.values()].sort((a, b) => a.id - b.id),
        depth: pending.depth,
      }
      pending.onDone?.(result)
      pending.resolve(result)
    }
  }

  // Any failure ends the worker: a crashed or unresponsive engine is unusable.
  // A crash or a go timeout stays recoverable; terminate() does not.
  private fail(error: EngineFailure) {
    if (this.failure) return
    if (error.reason === "terminated") this.stopped = true
    this.failure = error
    this.booting = false
    this.clearGoTimer()
    this.clearHandshakeTimer()
    this.onLine = null
    this.worker.onmessage = null
    this.worker.onerror = null
    this.worker.terminate()
    const rejectBoot = this.bootReject
    this.bootReject = null
    const pending = this.pending
    this.pending = null
    const waiting = this.waiting
    this.waiting = null
    const onError = pending?.onError ?? waiting?.handlers?.onError
    if (error.reason !== "terminated") {
      if (onError) onError(error)
      else this.hooks?.onFailure?.(error)
    }
    rejectBoot?.(error)
    pending?.reject(error)
    waiting?.reject(error)
  }

  private clearHandshakeTimer() {
    if (this.handshakeTimer) {
      clearTimeout(this.handshakeTimer)
      this.handshakeTimer = null
    }
  }

  private clearGoTimer() {
    if (this.goTimer) {
      clearTimeout(this.goTimer)
      this.goTimer = null
    }
  }
}
