import { describe, expect, it } from "vitest"

import type { EngineScore } from "@/context/engine-context"
import type { MoveEntry } from "@/context/game-context"
import type { MoveClassification } from "@/lib/chess/classification"
import { getGameSummary } from "@/lib/chess/game-summary"
import { getMoveNumbering } from "@/lib/chess/move-numbering"

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
const numbering = getMoveNumbering(START)
const cp = (value: number): EngineScore => ({ type: "cp", value })

// Builds a history from White-perspective scores of consecutive positions.
function historyOf(
  scores: EngineScore[],
  classifications: (MoveClassification | null)[] = []
): MoveEntry[] {
  return scores.slice(1).map((scoreAfter, index) => ({
    san: `m${index + 1}`,
    fen: START,
    scoreBefore: scores[index]!,
    scoreAfter,
    delta: null,
    classification: classifications[index] ?? null,
  }))
}

describe("getGameSummary", () => {
  it("is unavailable until every move is analysed", () => {
    expect(getGameSummary([], numbering)).toBeNull()
    const history = historyOf([cp(20), cp(30), cp(25)])
    history[1] = { ...history[1]!, scoreAfter: null }
    expect(getGameSummary(history, numbering)).toBeNull()
  })

  it("gives full accuracy for moves that keep the evaluation", () => {
    const summary = getGameSummary(
      historyOf([cp(20), cp(20), cp(20), cp(20), cp(20)]),
      numbering
    )
    expect(summary?.white.accuracy).toBeCloseTo(100)
    expect(summary?.black.accuracy).toBeCloseTo(100)
  })

  it("lowers the accuracy of the side that blundered", () => {
    // Black's second move gives White a winning position.
    const summary = getGameSummary(
      historyOf(
        [cp(20), cp(20), cp(20), cp(20), cp(600), cp(600)],
        ["best", "best", "best", "blunder", "best"]
      ),
      numbering
    )!
    expect(summary.white.accuracy).toBeGreaterThan(95)
    expect(summary.black.accuracy).toBeLessThan(70)
    expect(summary.black.counts.blunder).toBe(1)
    expect(summary.white.counts.best).toBe(3)
  })

  it("credits checkmate to the side that delivered it", () => {
    // Black mates: mate 0 after Black's move.
    const summary = getGameSummary(
      historyOf([
        cp(0),
        { type: "mate", value: -1 },
        { type: "mate", value: 0 },
      ]),
      numbering
    )!
    expect(summary.black.accuracy).toBeCloseTo(100)
    expect(summary.white.accuracy).toBeLessThan(10)
  })

  it("assigns moves to players in games where Black moves first", () => {
    const blackFirst = getMoveNumbering(
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    )
    const summary = getGameSummary(
      historyOf([cp(20), cp(600), cp(600)], ["blunder", "best"]),
      blackFirst
    )!
    expect(summary.black.counts.blunder).toBe(1)
    expect(summary.white.counts.best).toBe(1)
  })
})
