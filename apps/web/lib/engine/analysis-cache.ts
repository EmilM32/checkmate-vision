import type { EngineLine } from "@/context/engine-context"

export type CachedAnalysis = {
  depth: number
  // Best lines, scores from White's perspective.
  lines: EngineLine[]
  // The search ran to its own limit (depth or time) rather than being
  // interrupted, so repeating it would not find more.
  complete: boolean
}

// Move counters do not change the evaluation (bar the 50-move rule), so
// transpositions share one entry.
export function positionKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ")
}

function quality(entry: CachedAnalysis): number {
  return entry.depth * 10 + entry.lines.length
}

// Live analysis asks for 3 lines and game analysis for 2. One slot would let
// the shorter result replace the longer one and the board would flash 3→2→3.
function cacheKey(fen: string, multiPv: number): string {
  return `${positionKey(fen)}|${multiPv}`
}

/** Engine results per position and line count, least recently used first. */
export class AnalysisCache {
  private readonly entries = new Map<string, CachedAnalysis>()

  constructor(private readonly limit = 500) {}

  get(fen: string, multiPv: number): CachedAnalysis | undefined {
    const key = cacheKey(fen, multiPv)
    const entry = this.entries.get(key)
    if (entry) {
      this.entries.delete(key)
      this.entries.set(key, entry)
    }
    return entry
  }

  /** Stores the result unless a better one (deeper, more lines) is cached. */
  set(fen: string, multiPv: number, entry: CachedAnalysis) {
    if (entry.lines.length === 0) return

    const key = cacheKey(fen, multiPv)
    const existing = this.entries.get(key)
    if (existing && quality(existing) > quality(entry)) return

    this.entries.delete(key)
    this.entries.set(key, entry)
    if (this.entries.size > this.limit) {
      this.entries.delete(this.entries.keys().next().value!)
    }
  }

  clear() {
    this.entries.clear()
  }
}

export const analysisCache = new AnalysisCache()
