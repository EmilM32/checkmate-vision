import type { BatchAnalysisItem } from "@/context/engine-context"
import type {
  SearchLimits,
  SearchResult,
  UciEngine,
} from "@/lib/engine/uci-engine"

export type GameAnalysisOptions = {
  items: BatchAnalysisItem[]
  // Number of engines to run in parallel; each one is a separate worker.
  concurrency: number
  limits: SearchLimits
  // Receives a signal that aborts engines still starting when the run ends.
  startEngine: (signal: AbortSignal) => Promise<UciEngine>
  signal: AbortSignal
  onPosition: (item: BatchAnalysisItem, result: SearchResult) => void
}

// Leave one core for the live analysis and the UI. Positions of a game are
// independent, so game analysis scales with the number of workers; more
// than four mostly costs memory on typical devices.
export function getGameAnalysisConcurrency(
  hardwareConcurrency: number | undefined
): number {
  const cores =
    hardwareConcurrency && hardwareConcurrency > 0 ? hardwareConcurrency : 2
  return Math.max(1, Math.min(4, cores - 1))
}

/**
 * Analyses every position of a game with a pool of engines. Positions are
 * handed out in order but finish in any order; `onPosition` reports each
 * one as it completes. Resolves when all are done, rejects on an engine
 * failure, and stops early (resolving) when `signal` is aborted.
 */
export async function analyzeGamePositions({
  items,
  concurrency,
  limits,
  startEngine,
  signal,
  onPosition,
}: GameAnalysisOptions): Promise<void> {
  const engines: UciEngine[] = []
  const starting = new AbortController()
  const stopAll = () => {
    starting.abort()
    engines.forEach((engine) => engine.stop())
  }
  signal.addEventListener("abort", stopAll)

  let next = 0
  // Set once the run settles; an engine that finishes starting after that
  // (e.g. another one failed meanwhile) is shut down right away.
  let finished = false
  const runWorker = async () => {
    const engine = await startEngine(starting.signal)
    if (finished) {
      engine.terminate()
      return
    }
    engines.push(engine)

    while (!finished && !signal.aborted && next < items.length) {
      const item = items[next++]!
      const result = await engine.search(item.fen, limits)
      if (finished || signal.aborted) return
      onPosition(item, result)
    }
  }

  try {
    const workerCount = Math.max(1, Math.min(concurrency, items.length))
    await Promise.all(Array.from({ length: workerCount }, runWorker))
  } finally {
    finished = true
    starting.abort()
    signal.removeEventListener("abort", stopAll)
    engines.forEach((engine) => engine.terminate())
  }
}
