import { describe, expect, it } from "vitest"
import { buildEvalChartData } from "@/lib/chess/eval-history"

describe("buildEvalChartData", () => {
  it("starts with baseline point", () => {
    const points = buildEvalChartData([])
    expect(points).toHaveLength(1)
    expect(points[0]?.moveIndex).toBe(0)
    expect(points[0]?.eval).toBe(0)
  })

  it("maps cp score to white perspective and clamps to +/-10", () => {
    const points = buildEvalChartData([
      {
        san: "e4",
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        scoreBefore: null,
        scoreAfter: { type: "cp", value: 120 },
        delta: 0,
        classification: "best",
      },
      {
        san: "e5",
        fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        scoreBefore: null,
        scoreAfter: { type: "cp", value: 1500 },
        delta: 0,
        classification: "blunder",
      },
    ])

    expect(points[1]?.eval).toBeCloseTo(-1.2, 4)
    expect(points[2]?.eval).toBe(10)
  })

  it("maps mate score to +/-10 using side-to-move perspective", () => {
    const points = buildEvalChartData([
      {
        san: "Qh5",
        fen: "rnbqkbnr/pppppppp/8/7Q/8/8/PPPPPPPP/RNB1KBNR b KQkq - 0 1",
        scoreBefore: null,
        scoreAfter: { type: "mate", value: 2 },
        delta: 0,
        classification: "great",
      },
    ])

    expect(points[1]?.eval).toBe(-10)
  })
})
