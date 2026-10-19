import { describe, expect, it } from "vitest"

import { Chess } from "chess.js"

import type { EngineLine } from "@/context/engine-context"
import {
  buildMoveAnalysis,
  getSacrificedMaterial,
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

function playMoves(...sans: string[]) {
  const chess = new Chess()
  let last = null
  for (const san of sans) last = chess.move(san)
  return last!
}

describe("getSacrificedMaterial", () => {
  it("is zero for a quiet move", () => {
    expect(getSacrificedMaterial(playMoves("e4"))).toBe(0)
  })

  it("counts a piece given for a pawn", () => {
    // Nxf7: the knight takes a pawn and can be taken by the king.
    expect(
      getSacrificedMaterial(
        playMoves("e4", "e5", "Nf3", "d6", "Ng5", "h6", "Nxf7")
      )
    ).toBe(2)
  })

  it("does not count an even trade", () => {
    expect(
      getSacrificedMaterial(
        playMoves("e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Bxc6")
      )
    ).toBe(0)
    expect(getSacrificedMaterial(playMoves("e4", "d5", "exd5"))).toBe(0)
  })
})

const line = (id: 1 | 2 | 3, value: number, move: string): EngineLine => ({
  id,
  score: { type: "cp", value },
  pv: [move],
})

describe("buildMoveAnalysis", () => {
  it("derives the mover from the position before the move", () => {
    const analysis = buildMoveAnalysis({
      fenBefore: AFTER_E4,
      fenAfter: AFTER_E4_E5,
      linesBefore: [line(1, 30, "c7c5")],
      // Black's move handed White a winning position.
      scoreAfter: { type: "cp", value: 600 },
    })

    expect(analysis.classification).toBe("blunder")
    // Loss from the mover's point of view.
    expect(analysis.delta).toBe(570)
  })

  it("calls the engine's only good move great", () => {
    expect(
      buildMoveAnalysis({
        fenBefore: START,
        fenAfter: AFTER_E4,
        linesBefore: [line(1, 250, "e2e4"), line(2, 50, "d2d4")],
        scoreAfter: { type: "cp", value: 250 },
      }).classification
    ).toBe("great")
  })

  it("does not call a move great when the engine preferred another", () => {
    expect(
      buildMoveAnalysis({
        fenBefore: START,
        fenAfter: AFTER_E4,
        linesBefore: [line(1, 250, "d2d4"), line(2, 50, "c2c4")],
        scoreAfter: { type: "cp", value: 250 },
      }).classification
    ).toBe("best")
  })

  it("calls a sound sacrifice brilliant", () => {
    const move = playMoves("e4", "e5", "Nf3", "d6", "Ng5", "h6", "Nxf7")
    expect(
      buildMoveAnalysis({
        fenBefore: move.before,
        fenAfter: move.after,
        linesBefore: [line(1, 80, "g5f7")],
        scoreAfter: { type: "cp", value: 80 },
      }).classification
    ).toBe("brilliant")
  })

  it("leaves the move unclassified without engine lines", () => {
    expect(
      buildMoveAnalysis({
        fenBefore: START,
        fenAfter: AFTER_E4,
        linesBefore: [],
        scoreAfter: { type: "cp", value: 30 },
      }).classification
    ).toBeNull()
  })
})
