import { describe, expect, it } from "vitest"

import {
  buildMoveAnalysis,
  getPvGapCp,
  getTerminalScore,
} from "@/lib/chess/move-analysis"

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
const AFTER_E4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
const AFTER_E4_E5 =
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2"

describe("getTerminalScore", () => {
  it("scores checkmate as mate 0 and stalemate as a draw", () => {
    expect(
      getTerminalScore(
        "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4"
      )
    ).toEqual({ type: "mate", value: 0 })
    expect(getTerminalScore("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")).toEqual({
      type: "cp",
      value: 0,
    })
  })

  it("returns null for positions with legal moves", () => {
    expect(getTerminalScore(START)).toBeNull()
  })
})

describe("getPvGapCp", () => {
  it("measures the gap between the two best lines", () => {
    expect(
      getPvGapCp({ type: "cp", value: 40 }, { type: "cp", value: -35 })
    ).toBe(75)
  })

  it("is unknown without a second line or with mate scores", () => {
    expect(getPvGapCp({ type: "cp", value: 40 }, null)).toBeNull()
    expect(
      getPvGapCp({ type: "mate", value: 2 }, { type: "cp", value: 300 })
    ).toBeNull()
  })
})

describe("buildMoveAnalysis", () => {
  it("derives the mover from the position before the move", () => {
    const analysis = buildMoveAnalysis({
      ply: 2,
      fenBefore: AFTER_E4,
      fenAfter: AFTER_E4_E5,
      scoreBefore: { type: "cp", value: 30 },
      // Black's move handed White a winning position.
      scoreAfter: { type: "cp", value: 600 },
      pvGapCp: null,
    })

    expect(analysis.classification).toBe("blunder")
    // Loss from the mover's point of view.
    expect(analysis.delta).toBe(570)
  })

  it("leaves the move unclassified without both scores", () => {
    expect(
      buildMoveAnalysis({
        ply: 1,
        fenBefore: START,
        fenAfter: AFTER_E4,
        scoreBefore: null,
        scoreAfter: { type: "cp", value: 30 },
        pvGapCp: null,
      }).classification
    ).toBeNull()
  })
})
