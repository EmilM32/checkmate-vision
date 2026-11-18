import { describe, expect, it } from "vitest"

import { AnalysisCache, positionKey } from "@/lib/engine/analysis-cache"

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

function entry(depth: number, lineCount = 3, complete = true) {
  return {
    depth,
    complete,
    lines: Array.from({ length: lineCount }, (_, index) => ({
      id: (index + 1) as 1 | 2 | 3,
      score: { type: "cp" as const, value: 20 - index },
      pv: ["e2e4"],
    })),
  }
}

describe("positionKey", () => {
  it("ignores the move counters", () => {
    expect(positionKey(START)).toBe(positionKey(START.replace(" 0 1", " 4 12")))
  })
})

describe("AnalysisCache", () => {
  it("returns stored analysis for the same position", () => {
    const cache = new AnalysisCache()
    cache.set(START, 3, entry(20))

    expect(cache.get(START.replace(" 0 1", " 2 7"), 3)).toEqual(entry(20))
  })

  it("keeps the deeper analysis", () => {
    const cache = new AnalysisCache()
    cache.set(START, 3, entry(22))
    cache.set(START, 3, entry(12, 3, false))
    expect(cache.get(START, 3)?.depth).toBe(22)

    cache.set(START, 3, entry(24))
    expect(cache.get(START, 3)?.depth).toBe(24)
  })

  it("ignores results without lines", () => {
    const cache = new AnalysisCache()
    cache.set(START, 3, entry(0, 0))
    expect(cache.get(START, 3)).toBeUndefined()
  })

  it("evicts the least recently used position", () => {
    const cache = new AnalysisCache(2)
    const fens = [
      "8/8/8/8/8/8/8/K6k w",
      "8/8/8/8/8/8/8/K5k1 w",
      "8/8/8/8/8/8/8/K4k2 w",
    ]
    cache.set(fens[0]!, 3, entry(10))
    cache.set(fens[1]!, 3, entry(10))
    cache.get(fens[0]!, 3)
    cache.set(fens[2]!, 3, entry(10))

    expect(cache.get(fens[0]!, 3)).toBeDefined()
    expect(cache.get(fens[1]!, 3)).toBeUndefined()
    expect(cache.get(fens[2]!, 3)).toBeDefined()
  })

  it("keeps a separate entry per multipv", () => {
    const cache = new AnalysisCache()
    cache.set(START, 3, entry(22, 3))
    cache.set(START, 2, entry(30, 2))

    expect(cache.get(START, 3)?.lines).toHaveLength(3)
    expect(cache.get(START, 3)?.depth).toBe(22)
    expect(cache.get(START, 2)?.lines).toHaveLength(2)
    expect(cache.get(START, 2)?.depth).toBe(30)
  })
})
