import { describe, expect, it } from "vitest"

import type { MoveEntry } from "@/context/game-context"
import { getMoveReview } from "@/lib/chess/move-review"

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
const AFTER_F5 = "rnbqkbnr/ppppp1pp/8/5p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2"

function entry(san: string, fen: string, patch: Partial<MoveEntry>): MoveEntry {
  return {
    san,
    fen,
    scoreBefore: null,
    scoreAfter: null,
    delta: null,
    classification: null,
    ...patch,
  }
}

const history: MoveEntry[] = [
  entry("e4", AFTER_E4, {
    scoreBefore: { type: "cp", value: 20 },
    scoreAfter: { type: "cp", value: 25 },
    classification: "best",
    bestMove: "e2e4",
  }),
  entry("f5", AFTER_F5, {
    scoreBefore: { type: "cp", value: 25 },
    scoreAfter: { type: "cp", value: 120 },
    classification: "mistake",
    bestMove: "e7e5",
    bestScore: { type: "cp", value: 25 },
  }),
]

describe("getMoveReview", () => {
  it("has no alternative when the engine's move was played", () => {
    const review = getMoveReview(history, 1, START)!
    expect(review.best).toBeNull()
    expect(review.playedBy).toBe("white")
    expect(review.winChanceLoss).toBe(0)
  })

  it("names the engine's choice in SAN and the win chance lost", () => {
    const review = getMoveReview(history, 2, START)!
    expect(review.playedBy).toBe("black")
    expect(review.best).toEqual({
      uci: "e7e5",
      san: "e5",
      score: { type: "cp", value: 25 },
    })
    // From Black's side: +0.25 → +1.20 for White costs about 9 points.
    expect(review.winChanceLoss).toBeGreaterThan(8)
    expect(review.winChanceLoss).toBeLessThan(10)
  })

  it("is empty for unanalysed moves and the start position", () => {
    expect(getMoveReview(history, 0, START)).toBeNull()
    expect(getMoveReview([entry("e4", AFTER_E4, {})], 1, START)).toBeNull()
  })
})
