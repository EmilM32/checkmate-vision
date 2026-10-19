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
    cache.set(START, entry(20))

    expect(cache.get(START.replace(" 0 1", " 2 7"))).toEqual(entry(20))
  })

  it("keeps the deeper analysis", () => {
    const cache = new AnalysisCache()
    cache.set(START, entry(22))
    cache.set(START, entry(12, 3, false))
    expect(cache.get(START)?.depth).toBe(22)

    cache.set(START, entry(24))
    expect(cache.get(START)?.depth).toBe(24)
  })

  it("ignores results without lines", () => {
    const cache = new AnalysisCache()
    cache.set(START, entry(0, 0))
    expect(cache.get(START)).toBeUndefined()
  })

  it("evicts the least recently used position", () => {
    const cache = new AnalysisCache(2)
    const fens = [
      "8/8/8/8/8/8/8/K6k w",
      "8/8/8/8/8/8/8/K5k1 w",
      "8/8/8/8/8/8/8/K4k2 w",
    ]
    cache.set(fens[0]!, entry(10))
    cache.set(fens[1]!, entry(10))
    cache.get(fens[0]!)
    cache.set(fens[2]!, entry(10))

    expect(cache.get(fens[0]!)).toBeDefined()
    expect(cache.get(fens[1]!)).toBeUndefined()
    expect(cache.get(fens[2]!)).toBeDefined()
  })
})
